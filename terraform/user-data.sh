#!/bin/bash
# User Data Script for Video Transcoding Service EC2 Instances
# CAB432 Assignment 2 - Infrastructure as Code
# Auto-configures EC2 instances with Docker and application deployment

set -e

# Logging setup
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=== Video Transcoding Service EC2 Initialization ==="
echo "Timestamp: $(date)"
echo "Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)"
echo "Region: ${aws_region}"
echo "Student: ${student_number}"

# System updates and package installation
echo "=== Updating system packages ==="
apt-get update -y
apt-get upgrade -y

echo "=== Installing required packages ==="
apt-get install -y \
    docker.io \
    docker-compose \
    awscli \
    unzip \
    htop \
    curl \
    jq \
    nginx \
    fail2ban \
    ufw

# Docker configuration
echo "=== Configuring Docker ==="
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu

# Docker daemon configuration for better logging
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "awslogs",
  "log-opts": {
    "awslogs-group": "/aws/ec2/videotranscoder",
    "awslogs-region": "${aws_region}",
    "awslogs-stream": "$(curl -s http://169.254.169.254/latest/meta-data/instance-id)"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ]
}
EOF

systemctl restart docker

# Install Docker Compose v2
echo "=== Installing Docker Compose v2 ==="
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# AWS CLI configuration
echo "=== Configuring AWS CLI ==="
aws configure set region ${aws_region}

# Retrieve application configuration from Parameter Store
echo "=== Retrieving application configuration ==="
S3_ORIGINAL_BUCKET=$(aws ssm get-parameter --name "/videotranscoder/s3/original-bucket" --query "Parameter.Value" --output text)
S3_PROCESSED_BUCKET=$(aws ssm get-parameter --name "/videotranscoder/s3/processed-bucket" --query "Parameter.Value" --output text)
DYNAMODB_TABLE_PREFIX=$(aws ssm get-parameter --name "/videotranscoder/dynamodb/table-prefix" --query "Parameter.Value" --output text)
COGNITO_USER_POOL_ID=$(aws ssm get-parameter --name "/videotranscoder/cognito/user-pool-id" --query "Parameter.Value" --output text)
COGNITO_CLIENT_ID=$(aws ssm get-parameter --name "/videotranscoder/cognito/client-id" --query "Parameter.Value" --output text)
ECR_REPOSITORY_URI=$(aws ssm get-parameter --name "/videotranscoder/ecr/repository-uri" --query "Parameter.Value" --output text)

# Retrieve Cognito secrets
echo "=== Retrieving Cognito secrets ==="
COGNITO_SECRETS=$(aws secretsmanager get-secret-value --secret-id "${student_number}-cognito-config" --query "SecretString" --output text)
COGNITO_CLIENT_SECRET=$(echo $COGNITO_SECRETS | jq -r '.clientSecret')

# Create application configuration file
echo "=== Creating application configuration ==="
cat > /home/ubuntu/app-env.list << EOF
NODE_ENV=production
PORT=3000
AWS_REGION=${aws_region}
DATABASE_PROVIDER=dynamodb
STORAGE_PROVIDER=s3
CONFIG_PROVIDER=parameter-store
S3_ORIGINAL_BUCKET=$S3_ORIGINAL_BUCKET
S3_PROCESSED_BUCKET=$S3_PROCESSED_BUCKET
DYNAMODB_TABLE_PREFIX=$DYNAMODB_TABLE_PREFIX
COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID
COGNITO_CLIENT_SECRET=$COGNITO_CLIENT_SECRET
HTTPS_PORT=443
MAX_FILE_SIZE=100MB
CONCURRENT_TRANSCODING_JOBS=3
LOG_LEVEL=info
EOF

# Set proper permissions
chown ubuntu:ubuntu /home/ubuntu/app-env.list
chmod 600 /home/ubuntu/app-env.list

# ECR login and image pull
echo "=== Logging into ECR and pulling application image ==="
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin $ECR_REPOSITORY_URI

# Pull the latest application image
docker pull $ECR_REPOSITORY_URI:latest

# Create application directories
echo "=== Creating application directories ==="
mkdir -p /opt/videotranscoder/{logs,data,ssl}
chown -R ubuntu:ubuntu /opt/videotranscoder

# SSL certificate setup (if certificates exist)
echo "=== Setting up SSL certificates ==="
if [ -f /opt/ssl/certificate.pem ] && [ -f /opt/ssl/private-key.pem ]; then
    echo "SSL certificates found, copying to application directory"
    cp /opt/ssl/*.pem /opt/videotranscoder/ssl/
    chown ubuntu:ubuntu /opt/videotranscoder/ssl/*.pem
    chmod 600 /opt/videotranscoder/ssl/private-key.pem
else
    echo "SSL certificates not found, application will run HTTP only"
fi

# Create systemd service for the application
echo "=== Creating systemd service ==="
cat > /etc/systemd/system/videotranscoder.service << EOF
[Unit]
Description=Video Transcoding Service
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu
ExecStartPre=-/usr/bin/docker stop videotranscoder
ExecStartPre=-/usr/bin/docker rm videotranscoder
ExecStart=/usr/bin/docker run --name videotranscoder \
    --env-file /home/ubuntu/app-env.list \
    -p 3000:3000 \
    -p 443:443 \
    -v /opt/videotranscoder/logs:/app/logs \
    -v /opt/videotranscoder/data:/app/data \
    -v /opt/videotranscoder/ssl:/opt/ssl:ro \
    --restart unless-stopped \
    $ECR_REPOSITORY_URI:latest
ExecStop=/usr/bin/docker stop videotranscoder
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

# Start and enable the service
systemctl daemon-reload
systemctl enable videotranscoder
systemctl start videotranscoder

# Configure Nginx as a reverse proxy (optional)
echo "=== Configuring Nginx reverse proxy ==="
cat > /etc/nginx/sites-available/videotranscoder << EOF
server {
    listen 80;
    server_name ${domain_name} *.${domain_name};

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support for real-time features
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeout settings for large file uploads
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        client_max_body_size 100M;
    }
}
EOF

# Enable the Nginx site
ln -sf /etc/nginx/sites-available/videotranscoder /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t && systemctl restart nginx

# Configure UFW firewall
echo "=== Configuring firewall ==="
ufw --force enable
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp

# CloudWatch agent installation (optional)
echo "=== Installing CloudWatch agent ==="
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# CloudWatch agent configuration
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
    "agent": {
        "metrics_collection_interval": 60,
        "run_as_user": "cwagent"
    },
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/user-data.log",
                        "log_group_name": "/aws/ec2/videotranscoder",
                        "log_stream_name": "{instance_id}/user-data"
                    },
                    {
                        "file_path": "/opt/videotranscoder/logs/app.log",
                        "log_group_name": "/aws/ec2/videotranscoder",
                        "log_stream_name": "{instance_id}/application"
                    }
                ]
            }
        }
    },
    "metrics": {
        "namespace": "VideoTranscoder/EC2",
        "metrics_collected": {
            "cpu": {
                "measurement": [
                    "cpu_usage_idle",
                    "cpu_usage_iowait",
                    "cpu_usage_user",
                    "cpu_usage_system"
                ],
                "metrics_collection_interval": 60
            },
            "disk": {
                "measurement": [
                    "used_percent"
                ],
                "metrics_collection_interval": 60,
                "resources": [
                    "*"
                ]
            },
            "diskio": {
                "measurement": [
                    "io_time"
                ],
                "metrics_collection_interval": 60,
                "resources": [
                    "*"
                ]
            },
            "mem": {
                "measurement": [
                    "mem_used_percent"
                ],
                "metrics_collection_interval": 60
            }
        }
    }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
    -s

# Health check script
echo "=== Creating health check script ==="
cat > /home/ubuntu/health-check.sh << 'EOF'
#!/bin/bash
# Health check script for Video Transcoding Service

HEALTH_URL="http://localhost:3000/health"
LOG_FILE="/opt/videotranscoder/logs/health-check.log"

echo "$(date): Checking application health" >> $LOG_FILE

if curl -f -s $HEALTH_URL > /dev/null; then
    echo "$(date): Health check PASSED" >> $LOG_FILE
    exit 0
else
    echo "$(date): Health check FAILED" >> $LOG_FILE
    echo "$(date): Attempting to restart service" >> $LOG_FILE
    systemctl restart videotranscoder
    exit 1
fi
EOF

chmod +x /home/ubuntu/health-check.sh
chown ubuntu:ubuntu /home/ubuntu/health-check.sh

# Add health check to crontab
echo "*/5 * * * * /home/ubuntu/health-check.sh" | crontab -u ubuntu -

# Final status check
echo "=== Final status check ==="
sleep 30

docker ps
systemctl status videotranscoder --no-pager
systemctl status nginx --no-pager

# Test application
curl -f http://localhost:3000/health && echo "Application health check: PASSED" || echo "Application health check: FAILED"

# Signal completion
echo "=== EC2 initialization completed successfully ==="
echo "Timestamp: $(date)"
echo "Application should be available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
echo "Health check: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000/health"

# Send completion signal to CloudFormation/Terraform (if applicable)
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
aws ec2 create-tags --resources $INSTANCE_ID --tags Key=UserDataStatus,Value=Complete --region ${aws_region} || true

echo "User data script execution completed successfully" >> /var/log/user-data.log