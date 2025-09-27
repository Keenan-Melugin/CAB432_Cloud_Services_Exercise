# CAB432 Assignment 2 - Video Demonstration Checklist
## Complete Feature Demonstration Guide

**Student:** n10992511
**Domain:** mytranscoder.cab432.com
**Application:** Video Transcoding Service with Terraform Infrastructure

---

## Pre-Recording Setup Checklist

### Before Starting Video:
- [ ] Application running on https://mytranscoder.cab432.com:8443
- [ ] AWS Console logged in (multiple tabs open)
- [ ] Browser developer tools enabled
- [ ] Test user accounts ready (admin + regular user)
- [ ] MFA demo page ready (/mfa-demo.html)
- [ ] Video files for upload testing prepared

---

## Core Requirements Demonstration (MANDATORY)

### ✅ 1. First Data Persistence Service - S3
**Time: 2 minutes**

**Actions to Record:**
1. Open AWS S3 Console → Show both buckets:
   - `n10992511-videotranscoder-original`
   - `n10992511-videotranscoder-processed`
2. Upload video in application → show file appears in original bucket
3. Trigger transcoding → show processed video appears in processed bucket
4. **Key Statement:** "S3 provides unlimited storage for large video files without size restrictions like other AWS services"

### ✅ 2. Second Data Persistence Service - DynamoDB
**Time: 2 minutes**

**Actions to Record:**
1. Open AWS DynamoDB Console → Show three tables:
   - `videotranscoder-users`
   - `videotranscoder-videos` (highlight UserIdIndex GSI)
   - `videotranscoder-transcode-jobs` (highlight both GSIs)
2. Register new user → show user record in users table
3. Upload video → show metadata in videos table
4. **Key Statement:** "DynamoDB provides fast NoSQL queries for user sessions and video metadata with Global Secondary Indexes"

### ✅ 3. Core - Statelessness
**Time: 1 minute**

**Actions to Record:**
1. Show application running
2. Restart application (docker restart or pm2 restart)
3. Show all data persists (users, videos, etc.)
4. **Key Statement:** "Application stores no persistent state locally - all data in AWS services"

### ✅ 4. Core - Authentication with Cognito
**Time: 2 minutes**

**Actions to Record:**
1. Open AWS Cognito Console → Show User Pool `n10992511-videotranscoder`
2. Register new user → show email verification process
3. Login → show JWT token in browser storage
4. **Key Statement:** "Cognito provides secure authentication with JWT tokens"

### ✅ 5. Core - DNS with Route53
**Time: 1 minute**

**Actions to Record:**
1. Terminal: `nslookup mytranscoder.cab432.com` → show IP resolution
2. Browser: Navigate to https://mytranscoder.cab432.com:8443
3. **Key Statement:** "Custom domain provides professional access instead of raw EC2 IP"

### ✅ 6. Infrastructure as Code (3 MARKS)
**Time: 3 minutes**

**Actions to Record:**
1. Show Terraform files:
   - `terraform/main.tf` (286 lines)
   - `terraform/outputs.tf` (177 lines)
   - `terraform/variables.tf` (187 lines)
2. Terminal: `terraform plan` → show planned changes
3. Show AWS resources created by Terraform
4. **Key Statement:** "Complete infrastructure automation enabling reproducible deployments"

---

## Bonus Features Demonstration (EXTRA MARKS)

### ✅ 7. S3 Pre-signed URLs
**Time: 2 minutes**

**Actions to Record:**
1. Upload large video with browser developer tools open
2. Network tab → show direct S3 POST request (not through server)
3. Download video → show pre-signed S3 URL in network tab
4. **Key Statement:** "Direct S3 access reduces server load and provides secure time-limited access"

### ✅ 8. Cognito Groups
**Time: 2 minutes**

**Actions to Record:**
1. AWS Cognito Console → Show groups: admin (precedence 1), user (precedence 2)
2. Login as admin → show additional permissions
3. Login as regular user → show restricted access
4. **Key Statement:** "Groups provide scalable role-based access control"

### ✅ 9. Cognito Multi-Factor Authentication
**Time: 3 minutes**

**Actions to Record:**
1. Navigate to `/mfa-demo.html`
2. Setup TOTP → show QR code → scan with authenticator app
3. Login with MFA-enabled user → show challenge modal → enter code
4. Run `npm run test-mfa` → show automated testing
5. **Key Statement:** "MFA provides two-factor security with industry-standard TOTP"

### ✅ 10. Cognito Federated Identities
**Time: 2 minutes**

**Actions to Record:**
1. Click "Login with Google" button
2. Show redirect to Google OAuth
3. Complete authentication → return to app with JWT
4. AWS Console → show federated identity group
5. **Key Statement:** "Social authentication eliminates password management"

### ✅ 11. Parameter Store
**Time: 2 minutes**

**Actions to Record:**
1. AWS Systems Manager → Parameter Store → Show 6 parameters:
   - `/videotranscoder/s3/original-bucket`
   - `/videotranscoder/s3/processed-bucket`
   - `/videotranscoder/dynamodb/table-prefix`
   - `/videotranscoder/cognito/user-pool-id`
   - `/videotranscoder/cognito/client-id`
   - `/videotranscoder/ecr/repository-uri`
2. Show application reading configuration at runtime
3. **Key Statement:** "Centralized configuration management without hardcoded values"

### ✅ 12. Secrets Manager
**Time: 1 minute**

**Actions to Record:**
1. AWS Secrets Manager → Show `n10992511-cognito-config` secret
2. Show structure (values hidden for security)
3. **Key Statement:** "Secure credential storage with automatic rotation capability"

---

## Recording Tips

### Technical Setup:
- **Screen Resolution:** 1920x1080 or higher
- **Browser Zoom:** 100% for clear visibility
- **Audio:** Clear microphone, speak slowly
- **Recording Tool:** Use OBS Studio or similar

### Presentation Style:
- **Start each section:** "Now I'll demonstrate [feature name]"
- **Explain what you're doing:** "I'm opening the AWS console to show..."
- **Highlight key benefits:** Always state why each feature is valuable
- **End each section:** "This completes the [feature name] demonstration"

### Timing Guidelines:
- **Total Video:** ~20 minutes maximum
- **Core Requirements:** ~11 minutes
- **Bonus Features:** ~13 minutes
- **Buffer Time:** Plan for 2-3 minutes extra

---

## Post-Recording Checklist

### Final Deliverables:
- [ ] Video recording uploaded
- [ ] A2_response_Criteria.md completed with timestamps
- [ ] All code committed and pushed to GitHub
- [ ] Terraform infrastructure still running for grading

### Quality Check:
- [ ] All features demonstrated clearly
- [ ] Audio quality is clear
- [ ] Screen content is readable
- [ ] No sensitive information exposed
- [ ] Total time under 25 minutes

---

## Achievement Summary

**Core Requirements:** 6/6 ✅ (Maximum marks)
**Infrastructure as Code:** ✅ (3 bonus marks)
**Additional Bonus Features:** 6 ✅ (Exceptional implementation)

**Total Features Implemented:** 12 major features
**Expected Grade:** High Distinction range

This comprehensive implementation demonstrates enterprise-grade cloud architecture with full automation, security, and scalability features.