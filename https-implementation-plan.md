# HTTPS Implementation Plan - Self-Signed Certificate

## Issue
AWS Certificate Manager (ACM) is restricted in student account due to explicit deny policies.

## Solution
Implement HTTPS using self-signed certificates directly on the EC2 instance.

## Benefits for Assignment
- ✅ Demonstrates HTTPS/SSL implementation knowledge
- ✅ Shows proper TLS configuration
- ✅ No AWS account restrictions
- ✅ Full HTTPS functionality
- ⚠️ Browser security warnings (acceptable for educational purposes)

## Implementation Steps

### Step 1: Generate SSL Certificate on EC2
```bash
# SSH into EC2 instance
sudo mkdir -p /etc/ssl/certs
sudo mkdir -p /etc/ssl/private

# Generate private key
sudo openssl genrsa -out /etc/ssl/private/mytranscoder.key 2048

# Generate certificate
sudo openssl req -new -x509 -key /etc/ssl/private/mytranscoder.key \
  -out /etc/ssl/certs/mytranscoder.crt -days 365 \
  -subj "/C=AU/ST=Queensland/L=Brisbane/O=QUT/OU=CAB432/CN=mytranscoder.cab432.com"
```

### Step 2: Modify Node.js Application
- Add HTTPS server alongside HTTP
- Configure SSL certificate loading
- Handle both ports (3000 HTTP, 443 HTTPS)

### Step 3: Update Security Groups
- Allow port 443 (HTTPS) inbound traffic
- Keep port 3000 for HTTP

### Step 4: Test and Document
- Verify HTTPS access (with certificate acceptance)
- Update assignment documentation
- Demonstrate working HTTPS in submission video

## Alternative: CloudFlare Proxy
If self-signed proves problematic, CloudFlare can provide free SSL termination.