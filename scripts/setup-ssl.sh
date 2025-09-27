#!/bin/bash

# SSL Certificate Setup Script for Video Transcoding Service
# Run this on your EC2 instance to enable HTTPS

echo "🔒 Setting up SSL certificates for HTTPS..."

# Check if running as root/sudo
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run this script with sudo:"
  echo "   sudo ./scripts/setup-ssl.sh"
  exit 1
fi

# Create SSL directories
echo "📁 Creating SSL directories..."
mkdir -p /opt/ssl/
cd /opt/ssl/

# Generate private key
echo "🔑 Generating private key..."
openssl genrsa -out private-key.pem 2048

# Generate self-signed certificate
echo "📜 Generating self-signed certificate..."
openssl req -new -x509 -key private-key.pem \
  -out certificate.pem -days 365 \
  -subj "/C=AU/ST=Queensland/L=Brisbane/O=QUT/OU=CAB432/CN=mytranscoder.cab432.com" \
  -addext "subjectAltName=DNS:mytranscoder.cab432.com,DNS:localhost" \
  -addext "keyUsage=keyEncipherment,dataEncipherment" \
  -addext "extendedKeyUsage=serverAuth"

# Set proper permissions
echo "🔐 Setting secure permissions..."
chmod 600 private-key.pem
chmod 644 certificate.pem
chown root:root private-key.pem certificate.pem

# Verify certificate
echo "✅ Certificate generated successfully!"
echo ""
echo "📋 Certificate Details:"
openssl x509 -in certificate.pem -text -noout | grep -E "Subject:|DNS:|Not After"

echo ""
echo "🔧 Next Steps:"
echo "1. Restart your Node.js application: docker-compose restart"
echo "2. Access your app via: https://mytranscoder.cab432.com"
echo ""
echo "⚠️  Note: Browser will show security warning for self-signed certificate"
echo "   Click 'Advanced' → 'Proceed to mytranscoder.cab432.com' to continue"
echo ""
echo "🔍 Test HTTPS:"
echo "   curl -k https://mytranscoder.cab432.com/health"