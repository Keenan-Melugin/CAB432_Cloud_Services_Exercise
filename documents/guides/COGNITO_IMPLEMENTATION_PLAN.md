# 🎯 CAB432 Cognito Implementation Plan

## **📋 Practical Review Results:**

**✅ Fully Covered:** Core Cognito Authentication
**⚠️ Research Required:** MFA, Federated Identities, User Groups (no practicals exist)

## **🏗️ Current Project Analysis:**

**Your existing auth system:**
- bcrypt password hashing
- JWT token generation/verification
- Username/password login
- Role-based authorization (admin/user)
- Database-stored users

**Integration points:**
- `routes/auth.js` - Login endpoint
- `utils/auth.js` - JWT middleware & token generation
- All protected routes use `authenticateToken` middleware

## **📅 PHASED IMPLEMENTATION PLAN**

### **PHASE 1: Core Cognito Authentication (3 marks)**
*Fully supported by CAB432 practicals*

**Setup Requirements:**
1. Create Cognito User Pool via AWS console
2. Configure email verification with SES
3. Install required packages: `@aws-sdk/client-cognito-identity-provider`

**Implementation:**
- Replace `routes/auth.js` with Cognito signup/login/confirm endpoints
- Update JWT verification to use Cognito tokens
- Migrate existing users to Cognito (or recreate)
- Test signup → email confirm → login flow

**Testing via EC2:**
- User registration with email confirmation
- Login with Cognito JWT tokens
- Protected endpoint access verification

---

### **PHASE 2: Application Integration Testing**
*Bridge between old and new auth systems*

**Implementation:**
- Ensure existing protected routes work with Cognito JWTs
- Test video upload/transcode with new auth
- Verify role-based permissions still work
- Update frontend to handle Cognito flows

**Testing via EC2:**
- End-to-end video transcoding workflow
- Admin vs user permission testing
- Error handling and edge cases

---

### **PHASE 3: Cognito User Groups (2 marks)**
*Requires independent research - no CAB432 practical*

**Research & Implementation:**
- AWS documentation study for User Groups API
- Create admin/user groups in Cognito
- Replace role-based auth with group-based auth
- Update middleware to check group membership

**Testing via EC2:**
- Group assignment verification
- Permission enforcement testing
- Administrative group management

---

### **PHASE 4: Cognito MFA (2 marks)**
*Requires independent research - no CAB432 practical*

**Research & Implementation:**
- Study AWS Cognito MFA APIs (SMS/TOTP options)
- Implement MFA enrollment workflow
- Add MFA verification to login process
- Handle MFA challenges and responses

**Testing via EC2:**
- MFA enrollment process
- Login with MFA verification
- MFA recovery scenarios

---

### **PHASE 5: Federated Identities (2 marks)**
*Requires independent research - no CAB432 practical*

**Research & Implementation:**
- Configure Identity Pool for federated access
- Set up Google/Facebook identity providers
- Implement federated login flows
- Handle token exchange and user mapping

**Testing via EC2:**
- Social media login integration
- Identity provider token handling
- User profile merging/mapping

## **🛠️ Phase 1 Technical Requirements:**

**AWS Console Setup:**
- Create Cognito User Pool
- Configure signup/login attributes
- Set up email verification
- Configure SES for email delivery
- Note Client ID and Client Secret

**Code Changes:**
- Install `@aws-sdk/client-cognito-identity-provider`
- Replace auth routes with Cognito API calls
- Update JWT verification for Cognito tokens
- Modify user middleware extraction

**Project Enhancements Needed:**
1. **User Registration UI** - Frontend signup form
2. **Email Confirmation UI** - Code verification form
3. **Enhanced Error Handling** - Cognito-specific error responses
4. **User Migration Strategy** - Handle existing users
5. **Config Management** - Cognito User Pool settings

## **Assignment Value:**

**Phase 1:** Core Cognito Authentication (3 marks) - REQUIRED
**Phase 3:** Cognito User Groups (2 marks)
**Phase 4:** Cognito MFA (2 marks)
**Phase 5:** Federated Identities (2 marks)

**Total Potential:** 9 marks from identity management features

## **Implementation Notes:**

**CAB432 Practical Support:**
- Phase 1 has complete step-by-step guidance
- Phases 3-5 require independent AWS documentation research
- All phases build incrementally on previous work

**Testing Strategy:**
- Each phase includes EC2 testing requirements
- Progressive enhancement approach
- Fallback mechanisms for development

**Risk Mitigation:**
- Phase 1 is low-risk with full practical support
- Advanced phases may require coordinator consultation
- Implementation can stop at Phase 2 if needed for time constraints