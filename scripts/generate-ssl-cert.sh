#!/bin/bash

# Generate Self-Signed SSL Certificate for Video Transcoding Service
# This creates certificates for both localhost and the production domain

echo "🔒 Generating SSL certificates for HTTPS..."

# Create ssl directory
mkdir -p ./ssl

# Generate private key
openssl genrsa -out ./ssl/private-key.pem 2048

# Generate certificate signing request (CSR)
openssl req -new -key ./ssl/private-key.pem -out ./ssl/cert-request.csr -subj "/C=AU/ST=Queensland/L=Brisbane/O=QUT/OU=CAB432/CN=mytranscoder.cab432.com/subjectAltName=DNS:mytranscoder.cab432.com,DNS:localhost,DNS:*.cab432.com"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -in ./ssl/cert-request.csr -signkey ./ssl/private-key.pem -out ./ssl/certificate.pem -days 365 -extensions v3_req -extfile <(echo "[v3_req]
subjectAltName = DNS:mytranscoder.cab432.com,DNS:localhost,DNS:*.cab432.com
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth")

# Clean up CSR file
rm ./ssl/cert-request.csr

echo "✅ SSL certificates generated:"
echo "   Private Key: ./ssl/private-key.pem"
echo "   Certificate: ./ssl/certificate.pem"
echo ""
echo "⚠️  Note: This is a self-signed certificate."
echo "   Browsers will show a security warning that you can accept."
echo ""
echo "🔧 Certificate details:"
openssl x509 -in ./ssl/certificate.pem -text -noout | grep -E "Subject:|DNS:"