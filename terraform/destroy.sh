#!/bin/bash
# Destruction Script for Video Transcoding Service
# CAB432 Assignment 2 - Infrastructure as Code
# Student: n10992511

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR"
FORCE_DESTROY="${1:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo "====================================="
echo "Video Transcoding Service Destruction"
echo "Infrastructure as Code with Terraform"
echo "CAB432 Assignment 2"
echo "Student: n10992511"
echo "====================================="
echo

# Safety confirmation
if [ "$FORCE_DESTROY" != "true" ]; then
    echo "  WARNING: This will destroy ALL infrastructure resources!"
    echo
    echo "This includes:"
    echo "   - EC2 instances and Auto Scaling Groups"
    echo "   - Application Load Balancer"
    echo "   - S3 buckets (and all video files)"
    echo "   - DynamoDB tables (and all data)"
    echo "   - Cognito User Pool (and all users)"
    echo "   - ECR repository (and all images)"
    echo "   - Route53 records"
    echo "   - Parameter Store entries"
    echo "   - Secrets Manager secrets"
    echo "   - CloudWatch logs"
    echo
    echo " Data Loss Warning:"
    echo "   - All video files will be permanently deleted"
    echo "   - All user accounts and data will be lost"
    echo "   - All transcoding job history will be erased"
    echo
    echo "This action cannot be undone!"
    echo
    read -p "Are you absolutely sure you want to continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log "Destruction cancelled by user"
        exit 0
    fi

    echo
    read -p "Please type 'DESTROY' to confirm: " destroy_confirm
    if [ "$destroy_confirm" != "DESTROY" ]; then
        log "Destruction cancelled - confirmation text did not match"
        exit 0
    fi
fi

cd "$TERRAFORM_DIR"

# Pre-destruction checks
log "Running pre-destruction checks..."

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    error "Terraform is not installed"
    exit 1
fi

# Check if Terraform state exists
if [ ! -f "terraform.tfstate" ] && [ ! -f ".terraform/terraform.tfstate" ]; then
    warning "No Terraform state file found. Infrastructure may not be managed by Terraform."
    echo
    read -p "Continue anyway? (yes/no): " continue_confirm
    if [ "$continue_confirm" != "yes" ]; then
        log "Destruction cancelled"
        exit 0
    fi
fi

# Initialize Terraform
log "Initializing Terraform..."
terraform init

# Show what will be destroyed
log "Planning destruction..."
terraform plan -destroy -var-file="terraform.tfvars" -out=destroy.tfplan

echo
log "The above resources will be destroyed."
if [ "$FORCE_DESTROY" != "true" ]; then
    read -p "Proceed with destruction? (yes/no): " final_confirm
    if [ "$final_confirm" != "yes" ]; then
        log "Destruction cancelled"
        rm -f destroy.tfplan
        exit 0
    fi
fi

# Empty S3 buckets before destruction (required for deletion)
log "Emptying S3 buckets..."

STUDENT_NUMBER="n10992511"
S3_BUCKETS=(
    "${STUDENT_NUMBER}-videotranscoder-original"
    "${STUDENT_NUMBER}-videotranscoder-processed"
    "${STUDENT_NUMBER}-mytranscoder-frontend"
)

for bucket in "${S3_BUCKETS[@]}"; do
    if aws s3 ls "s3://$bucket" 2>/dev/null; then
        log "Emptying S3 bucket: $bucket"
        aws s3 rm "s3://$bucket" --recursive

        # Remove any object versions if versioning is enabled
        aws s3api list-object-versions --bucket "$bucket" --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text | while read key version; do
            if [ ! -z "$key" ] && [ ! -z "$version" ]; then
                aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version"
            fi
        done

        # Remove any delete markers
        aws s3api list-object-versions --bucket "$bucket" --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output text | while read key version; do
            if [ ! -z "$key" ] && [ ! -z "$version" ]; then
                aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version"
            fi
        done

        success "Emptied S3 bucket: $bucket"
    else
        log "S3 bucket not found or already empty: $bucket"
    fi
done

# Stop all EC2 instances in the Auto Scaling Group
log "Stopping EC2 instances..."
ASG_NAME=$(terraform output -raw autoscaling_group_name 2>/dev/null || echo "")
if [ ! -z "$ASG_NAME" ]; then
    # Set desired capacity to 0
    aws autoscaling update-auto-scaling-group --auto-scaling-group-name "$ASG_NAME" --desired-capacity 0 --min-size 0
    log "Set Auto Scaling Group desired capacity to 0"

    # Wait for instances to terminate
    log "Waiting for instances to terminate..."
    sleep 30
fi

# Deregister any remaining container images in ECR
log "Cleaning up ECR repository..."
ECR_REPO="${STUDENT_NUMBER}-video-transcoding-service"
if aws ecr describe-repositories --repository-names "$ECR_REPO" --region ap-southeast-2 2>/dev/null; then
    # List and delete all images
    IMAGE_DIGESTS=$(aws ecr list-images --repository-name "$ECR_REPO" --region ap-southeast-2 --query 'imageIds[].imageDigest' --output text)
    if [ ! -z "$IMAGE_DIGESTS" ]; then
        echo "$IMAGE_DIGESTS" | xargs -n1 -I {} aws ecr batch-delete-image --repository-name "$ECR_REPO" --region ap-southeast-2 --image-ids imageDigest={}
        success "Cleaned up ECR images"
    fi
fi

# Apply destruction
log "Applying Terraform destruction..."
terraform apply -auto-approve destroy.tfplan

if [ $? -eq 0 ]; then
    success "Infrastructure destruction completed successfully!"

    # Additional cleanup
    log "Performing additional cleanup..."

    # Remove any remaining security group rules (if custom security groups were created)
    # Note: We don't delete CAB432SG as it's QUT-managed

    # Clean up any remaining CloudWatch logs
    aws logs describe-log-groups --log-group-name-prefix "/aws/ec2/videotranscoder" --query 'logGroups[].logGroupName' --output text | while read log_group; do
        if [ ! -z "$log_group" ]; then
            aws logs delete-log-group --log-group-name "$log_group" 2>/dev/null || true
            log "Deleted CloudWatch log group: $log_group"
        fi
    done

    # Clean up Terraform state
    log "Cleaning up Terraform state..."
    rm -f terraform.tfstate.backup
    rm -f destroy.tfplan

    echo
    echo "🧹 DESTRUCTION COMPLETE! 🧹"
    echo "=========================="
    echo
    echo "All infrastructure resources have been destroyed:"
    echo "   - EC2 instances terminated"
    echo "   - Auto Scaling Group deleted"
    echo "   - Load Balancer removed"
    echo "   - S3 buckets emptied and deleted"
    echo "   - DynamoDB tables deleted"
    echo "   - Cognito User Pool deleted"
    echo "   - ECR repository deleted"
    echo "   - Route53 records removed"
    echo "   - Parameter Store entries deleted"
    echo "   - Secrets Manager secrets deleted"
    echo "   - CloudWatch resources cleaned up"
    echo
    echo " Note: QUT-managed resources were preserved:"
    echo "   - VPC (vpc-007bab53289655834)"
    echo "   - Security Group (CAB432SG)"
    echo "   - IAM Role (CAB432-Instance-Role)"
    echo
    echo "Your AWS account is now clean and ready for redeployment."
    echo

else
    error "Infrastructure destruction failed"
    echo
    echo "Manual cleanup may be required. Check the Terraform state and AWS console."
    echo "Common issues:"
    echo "  - S3 buckets not empty (run the cleanup script)"
    echo "  - DynamoDB tables with deletion protection"
    echo "  - EC2 instances still running"
    echo "  - Load balancer dependencies"
    exit 1
fi

# Clean up
rm -f destroy.tfplan

log "Destruction script completed"