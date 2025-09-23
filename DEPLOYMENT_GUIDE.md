# Practical: Deploying Video Transcoding Service to AWS

**CAB432 Assignment 1 - Cloud Computing**

---

## Table of Contents

1. [Learning Objectives](#learning-objectives)
2. [Prerequisites](#prerequisites)
3. [Step 1: Set up your development environment](#step-1-set-up-your-development-environment)
4. [Step 2: Create EC2 Instance](#step-2-create-ec2-instance)
5. [Step 3: Create ECR Repository](#step-3-create-ecr-repository)
6. [Step 4: Build and Push Docker Image](#step-4-build-and-push-docker-image)
7. [Step 5: Deploy Container to EC2](#step-5-deploy-container-to-ec2)
8. [Step 6: Test Application](#step-6-test-application)
9. [Step 7: Run Load Testing](#step-7-run-load-testing)
10. [Common Errors](#common-errors)
11. [Additional Reading](#additional-reading)

---

## Learning Objectives

This practical involves deploying a containerized video transcoding application to AWS using EC2 and ECR. The goal is to demonstrate all **7 core criteria** for CAB432 Assignment 1:

- Deploy a **CPU-intensive application** (video transcoding with FFmpeg)
- Implement **load testing** to achieve >80% CPU usage for 5+ minutes
- Use **two data types**: structured data (SQLite) and unstructured data (video files)
- **Containerize** the application using Docker
- **Deploy the container** from ECR to EC2
- Provide a **REST API** for video operations
- Implement **user authentication** with JWT tokens

This activity uses **QUT's AWS infrastructure** with specific security groups, IAM roles, and naming conventions required for assignment compliance.

---

## Prerequisites

- Access to QUT's AWS console via SSO: [CAB432 AWS Access](https://d-97671c4bd0.awsapps.com/start/#/)
- Completion of **Week 1 Practicals**: Creating an EC2 Instance, Remotely connecting to an EC2 instance
- Completion of **Week 2 Practicals**: Getting Started with Docker, Publishing an image to AWS ECR
- Docker installed on your local machine
- Your QUT username (e.g., `n1234567`)

---

## Step 1: Set up your development environment

The first step is to prepare your local environment and set up the necessary variables for deployment.

**Important:** Your ECR repository name must start with your QUT username to identify you and follow QUT naming conventions.

1. Open your terminal and set your QUT username variable:

```bash
export QUT_USERNAME="n1234567"  # Replace with your actual QUT username
```

2. Verify your username is set correctly:

```bash
echo "Using QUT username: $QUT_USERNAME"
```

3. Navigate to your CAB432 project directory:

```bash
cd /path/to/your/CAB432
```

4. Build the Docker image locally to test it works:

```bash
docker build -t video-transcoding-service .
```

You should see Docker building your image with multiple steps completing successfully. The final line should show something like:

```
Successfully tagged video-transcoding-service:latest
```

5. Test your image runs locally:

```bash
docker run -d -p 3000:3000 --name test-transcoder video-transcoding-service
```

6. Verify the application is working:

```bash
curl http://localhost:3000
```

You should see the HTML response from your application.

7. Stop and remove the test container:

```bash
docker stop test-transcoder
docker rm test-transcoder
```

---

## Step 2: Create EC2 Instance

Now you'll create an EC2 instance using QUT's specific requirements and infrastructure.

**Important:** You must use the `CAB432SG` security group and `CAB432-Instance-Role` IAM role as specified in the practicals.

1. Create a key pair with your username prefix:

```bash
aws ec2 create-key-pair \
    --key-name ${QUT_USERNAME}-video-transcoder \
    --query 'KeyMaterial' \
    --output text > ~/.ssh/${QUT_USERNAME}-video-transcoder.pem
```

2. Set the correct permissions on your key file:

```bash
chmod 400 ~/.ssh/${QUT_USERNAME}-video-transcoder.pem
```

3. Launch your EC2 instance using Ubuntu 24.04 LTS:

```bash
aws ec2 run-instances \
    --image-id ami-03f0544597f43a91d \
    --count 1 \
    --instance-type t3.micro \
    --key-name ${QUT_USERNAME}-video-transcoder \
    --security-groups CAB432SG \
    --iam-instance-profile Name=CAB432-Instance-Role \
    --associate-public-ip-address \
    --instance-initiated-shutdown-behavior terminate \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${QUT_USERNAME}-video-transcoder},{Key=qut-username,Value=${QUT_USERNAME}},{Key=purpose,Value=CAB432-Assignment1}]" \
    --user-data '#!/bin/bash
apt update -y
apt install -y docker.io unzip htop
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install --bin-dir /usr/local/bin --install-dir /usr/local/aws-cli
'
```

**About t3.micro instances:** These instances are part of AWS's burstable performance family. They provide baseline CPU performance with the ability to burst above baseline when needed. This makes them ideal for applications with variable workloads like our video transcoding service that has periods of high CPU usage.

4. Get your instance's public IP address:

```bash
aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=${QUT_USERNAME}-video-transcoder" "Name=instance-state-name,Values=running" \
    --query 'Reservations[*].Instances[*].[PublicIpAddress,InstanceId]' \
    --output table
```

Note down the **Public IP address** and **Instance ID** - you'll need these for the next steps.

---

## Step 3: Create ECR Repository

Amazon Elastic Container Registry (ECR) is a fully managed container registry that makes it easy to store, manage, and deploy Docker container images.

1. Create your ECR repository with the required naming convention:

```bash
aws ecr create-repository \
    --repository-name ${QUT_USERNAME}-video-transcoding-service \
    --region ap-southeast-2
```

**Important:** The repository name must start with your QUT username. This is a QUT requirement for identification and resource management.

2. Verify your repository was created:

```bash
aws ecr describe-repositories --repository-names ${QUT_USERNAME}-video-transcoding-service
```

You should see details about your repository, including the `repositoryUri` which will look like:
`901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n1234567-video-transcoding-service`

---

## Step 4: Build and Push Docker Image

Now you'll tag your local Docker image and push it to your ECR repository.

1. Set the ECR URI variable for convenience:

```bash
export ECR_URI="901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/${QUT_USERNAME}-video-transcoding-service"
```

2. Login to ECR:

```bash
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com
```

You should see: `Login Succeeded`

3. Tag your local image for ECR:

```bash
docker tag video-transcoding-service:latest ${ECR_URI}:latest
```

4. Push the image to ECR:

```bash
docker push ${ECR_URI}:latest
```

This will upload your Docker image to AWS. You'll see progress bars for each layer being pushed.

5. Verify the image was pushed successfully:

```bash
aws ecr list-images --repository-name ${QUT_USERNAME}-video-transcoding-service
```

You should see your image listed with a `latest` tag and an `imageDigest`.

---

## Step 5: Deploy Container to EC2

Now you'll connect to your EC2 instance and deploy your container from ECR.

1. SSH into your EC2 instance (replace `[PUBLIC-IP]` with your actual IP from Step 2):

```bash
ssh -i ~/.ssh/${QUT_USERNAME}-video-transcoder.pem ubuntu@[PUBLIC-IP]
```

You should see the Ubuntu welcome message and a prompt like: `ubuntu@ip-xxx-xxx-xxx-xxx:~$`

2. Configure AWS CLI on the EC2 instance using SSO:

```bash
aws configure sso --use-device-code
```

Use these settings when prompted:
- **SSO session name:** `default`
- **SSO start URL:** `https://d-97671c4bd0.awsapps.com/start/#/`
- **SSO region:** `ap-southeast-2`
- **Account ID:** `901444280953`

Follow the instructions to visit the URL and enter the device code. Select the default role when prompted.

3. Set your environment variables on the EC2 instance:

```bash
export QUT_USERNAME="n1234567"  # Replace with your username
export ECR_URI="901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/${QUT_USERNAME}-video-transcoding-service"
```

4. Login to ECR from your EC2 instance:

```bash
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com
```

5. Pull your image from ECR:

```bash
docker pull ${ECR_URI}:latest
```

6. Run your container:

```bash
docker run -d \
    --name video-transcoder \
    -p 3000:3000 \
    --restart unless-stopped \
    ${ECR_URI}:latest
```

7. Verify the container is running:

```bash
docker ps
```

You should see your container listed with status "Up".

8. Check the application logs:

```bash
docker logs video-transcoder
```

You should see log messages indicating the server started successfully.

---

## Step 6: Test Application

Now you'll test that your video transcoding application is working correctly.

1. Test the application locally on EC2:

```bash
curl http://localhost:3000
```

You should see HTML content returned, indicating the web server is responding.

2. Exit SSH and test from your local machine (replace `[PUBLIC-IP]` with your instance IP):

```bash
exit  # Exit SSH session
curl http://[PUBLIC-IP]:3000
```

3. Open your web browser and navigate to:

```
http://[PUBLIC-IP]:3000
```

You should see the Video Transcoding Service web interface.

4. Test the login functionality:
   - Click login and use username: `user1`, password: `password`
   - You should see the main application interface after successful login

5. Test video upload (optional - for demonstration):
   - Click "Choose File" and select a small video file
   - Click "Upload Video"
   - You should see a success message

**Note:** For assignment demonstration, you don't need to upload large videos. The important part is that the interface works and the load testing generates CPU usage.

---

## Step 7: Run Load Testing

This step demonstrates the CPU-intensive requirement by running the load testing script to achieve >80% CPU usage for 5+ minutes.

1. SSH back into your EC2 instance:

```bash
ssh -i ~/.ssh/${QUT_USERNAME}-video-transcoder.pem ubuntu@[PUBLIC-IP]
```

2. Run the load testing script:

```bash
docker exec video-transcoder node load_test.js
```

The script will create multiple simultaneous transcoding jobs to generate high CPU load.

3. In a **separate terminal window**, SSH into the instance again and monitor CPU usage:

```bash
ssh -i ~/.ssh/${QUT_USERNAME}-video-transcoder.pem ubuntu@[PUBLIC-IP]
```

```bash
htop
```

**What you should observe:**
- CPU usage should climb to **80% or higher**
- Multiple `ffmpeg` processes running
- High memory and disk I/O usage
- Sustained high CPU usage for **5+ minutes**

4. You can also monitor using the `top` command:

```bash
top -p $(docker inspect --format='{{.State.Pid}}' video-transcoder)
```

5. Monitor Docker container stats:

```bash
docker stats video-transcoder
```

**Important for Assignment:** Take screenshots of the CPU usage during load testing. This is critical evidence for your assignment submission.

The load test creates 3 concurrent transcoding jobs which will demonstrate the CPU-intensive nature of video processing using FFmpeg.

---

## Common Errors

### Error 1: "Key pair already exists"

If you get an error about the key pair already existing:

```bash
aws ec2 delete-key-pair --key-name ${QUT_USERNAME}-video-transcoder
```

Then re-run the key pair creation command from Step 2.

### Error 2: "Security group 'CAB432SG' does not exist"

This means you don't have access to the QUT security group. Ensure:
- You're logged into the correct AWS account (901444280953)
- You're in the ap-southeast-2 region
- You have completed the prerequisite practicals

### Error 3: "Cannot connect to Docker daemon"

On your EC2 instance, if Docker commands fail:

```bash
sudo systemctl start docker
sudo usermod -aG docker ubuntu
```

Then logout and login again:

```bash
exit
ssh -i ~/.ssh/${QUT_USERNAME}-video-transcoder.pem ubuntu@[PUBLIC-IP]
```

### Error 4: "ECR login failed"

If ECR login fails, check:

```bash
aws sts get-caller-identity
```

Ensure you're authenticated with the correct account. If not, re-run:

```bash
aws configure sso --use-device-code
```

### Error 5: "Container port not accessible"

If you can't access the application on port 3000:

1. Check the container is running:

```bash
docker ps
```

2. Check port binding:

```bash
docker port video-transcoder
```

3. Test locally first:

```bash
curl http://localhost:3000
```

### Error 6: "Instance stopped due to QUT policy"

QUT automatically stops all instances at 3:00 AM daily. To restart:

1. Start your instance:

```bash
aws ec2 start-instances --instance-ids [YOUR-INSTANCE-ID]
```

2. Get the new public IP (it will change):

```bash
aws ec2 describe-instances --instance-ids [YOUR-INSTANCE-ID] --query 'Reservations[*].Instances[*].PublicIpAddress'
```

3. SSH in and start your container:

```bash
docker start video-transcoder
```

---

## Additional Reading

- **AWS EC2 User Guide**: https://docs.aws.amazon.com/ec2/
- **AWS ECR User Guide**: https://docs.aws.amazon.com/ecr/
- **Docker Documentation**: https://docs.docker.com/
- **FFmpeg Documentation**: https://ffmpeg.org/documentation.html

### Assignment Submission Requirements

For your assignment submission, ensure you have:

1. **5-minute demonstration video** showing:
   - Application running on EC2
   - Successful login and basic functionality
   - Load testing with CPU monitoring >80%
   - Evidence of container deployed from ECR

2. **Response document** mapping each criterion to your implementation

3. **Screenshots** of:
   - ECR repository with your image
   - EC2 instance details
   - Application web interface
   - CPU usage during load testing
   - Container running on EC2

### Cleanup Instructions

**Important:** After assignment submission, clean up your AWS resources to avoid charges:

```bash
# Stop and remove container
docker stop video-transcoder
docker rm video-transcoder

# Terminate EC2 instance
aws ec2 terminate-instances --instance-ids [YOUR-INSTANCE-ID]

# Delete ECR repository
aws ecr delete-repository --repository-name ${QUT_USERNAME}-video-transcoding-service --force

# Delete key pair
aws ec2 delete-key-pair --key-name ${QUT_USERNAME}-video-transcoder
```

---

**CAB432 Assignment 1 - Video Transcoding Service Deployment**  
*QUT TEQSA PRV12079 | CRICOS 00213J | ABN 83 791 724 622*