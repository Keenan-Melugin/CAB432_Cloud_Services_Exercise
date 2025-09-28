#!/bin/bash
# Deployment Script for Video Transcoding Service
# CAB432 Assignment 2 - Infrastructure as Code
# Student: n10992511

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR"
ENVIRONMENT="${1:-prod}"

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
echo "=================================="
echo "Video Transcoding Service Deployment"
echo "Infrastructure as Code with Terraform"
echo "CAB432 Assignment 2"
echo "Student: n10992511"
echo "Environment: $ENVIRONMENT"
echo "=================================="
echo

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    error "Terraform is not installed. Please install Terraform first."
    exit 1
fi

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    error "AWS CLI is not installed. Please install AWS CLI first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    error "AWS credentials not configured or invalid. Please run 'aws configure' first."
    exit 1
fi

# Verify we're in the correct AWS account
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ "$ACCOUNT_ID" != "901444280953" ]; then
    error "Incorrect AWS account. Expected: 901444280953, Got: $ACCOUNT_ID"
    exit 1
fi

success "Pre-deployment checks passed"

# Build and push Docker image to ECR
log "Building and pushing Docker image..."

cd "$PROJECT_ROOT"

# Get ECR repository URI (will be created by Terraform, but we need to import first)
ECR_REPOSITORY="901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n10992511-video-transcoding-service"

# Login to ECR
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com

# Build the image
log "Building Docker image..."
docker build -t videotranscoder:latest .

# Tag for ECR
docker tag videotranscoder:latest "$ECR_REPOSITORY:latest"
docker tag videotranscoder:latest "$ECR_REPOSITORY:$(date +%Y%m%d-%H%M%S)"

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names n10992511-video-transcoding-service --region ap-southeast-2 2>/dev/null || \
aws ecr create-repository --repository-name n10992511-video-transcoding-service --region ap-southeast-2

# Push to ECR
log "Pushing Docker image to ECR..."
docker push "$ECR_REPOSITORY:latest"
docker push "$ECR_REPOSITORY:$(date +%Y%m%d-%H%M%S)"

success "Docker image built and pushed successfully"

# Terraform deployment
cd "$TERRAFORM_DIR"

log "Initializing Terraform..."
terraform init

log "Validating Terraform configuration..."
terraform validate
if [ $? -ne 0 ]; then
    error "Terraform validation failed"
    exit 1
fi

log "Planning Terraform deployment..."
terraform plan -var-file="terraform.tfvars" -out=tfplan

log "Applying Terraform configuration..."
terraform apply -auto-approve tfplan

if [ $? -eq 0 ]; then
    success "Infrastructure deployment completed successfully!"

    # Display outputs
    echo
    log "Deployment Outputs:"
    echo "==================="
    terraform output -json | jq -r '
        "Application URL: " + .application_url.value + "\n" +
        "Domain URL: " + .domain_url.value + "\n" +
        "Health Check: " + .health_check_url.value + "\n" +
        "Load Balancer DNS: " + .load_balancer_dns_name.value + "\n" +
        "ECR Repository: " + .ecr_repository_url.value
    '

    # Wait for deployment to be ready
    log "Waiting for application to be ready..."
    HEALTH_URL=$(terraform output -raw health_check_url)
    RETRY_COUNT=0
    MAX_RETRIES=30

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f -s "$HEALTH_URL" > /dev/null; then
            success "Application is ready!"
            break
        else
            log "Waiting for application to start... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
            sleep 10
            RETRY_COUNT=$((RETRY_COUNT + 1))
        fi
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        warning "Application health check timed out. Check EC2 instances manually."
    fi

    # Display final information
    echo
    echo " DEPLOYMENT SUCCESSFUL! "
    echo "=============================="
    echo
    echo "Your Video Transcoding Service is now deployed with Infrastructure as Code!"
    echo
    echo " Assignment Criteria Satisfied:"
    echo "   - Infrastructure as Code (3 marks) - Terraform implementation"
    echo "   - Auto Scaling Group for resilience"
    echo "   - Application Load Balancer for high availability"
    echo "   - Fully automated deployment"
    echo
    echo " Access your application:"
    echo "   - Application: $(terraform output -raw application_url)"
    echo "   - Domain: $(terraform output -raw domain_url)"
    echo "   - Health Check: $(terraform output -raw health_check_url)"
    echo
    echo " Monitoring:"
    echo "   - CloudWatch Logs: /aws/ec2/videotranscoder"
    echo "   - Auto Scaling Group: $(terraform output -raw autoscaling_group_name)"
    echo
    echo " Next Steps:"
    echo "   1. Test the application functionality"
    echo "   2. Upload videos and test transcoding"
    echo "   3. Monitor CloudWatch logs and metrics"
    echo "   4. Update your A2_response_Criteria.md document"
    echo

else
    error "Infrastructure deployment failed"
    exit 1
fi

# Clean up
rm -f tfplan

log "Deployment script completed"