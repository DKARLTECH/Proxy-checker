#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/var/log/vps_setup.log"
exec > >(tee -a "$LOG_FILE") 2>&1

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

# Update system
update_system() {
    print_status "Updating system packages..."
    apt update && apt upgrade -y
    apt install -y curl wget git sudo ufw net-tools
}

# Configure SSH
configure_ssh() {
    print_status "Configuring SSH..."
    
    # Backup original sshd_config
    cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
    
    # Configure SSH
    cat > /etc/ssh/sshd_config << EOF
Port 22
Protocol 2
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_ed25519_key
SyslogFacility AUTH
LogLevel INFO
LoginGraceTime 60
PermitRootLogin yes
StrictModes yes
MaxAuthTries 3
MaxSessions 10
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PasswordAuthentication yes
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding yes
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

    # Restart SSH service
    systemctl restart ssh
    systemctl enable ssh
    print_success "SSH configured successfully"
}

# Install and configure SSL (Let's Encrypt)
install_ssl() {
    print_status "Installing SSL (Let's Encrypt)..."
    
    # Install certbot
    apt install -y certbot python3-certbot-nginx
    
    print_warning "SSL certificates will be generated for your domains later"
    print_success "SSL tools installed successfully"
}

# Install and configure V2Ray
install_v2ray() {
    print_status "Installing V2Ray..."
    
    # Download and install V2Ray
    bash <(curl -L https://raw.githubusercontent.com/v2fly/fhs-install-v2ray/master/install-release.sh)
    
    # Create V2Ray configuration
    mkdir -p /usr/local/etc/v2ray
    cat > /usr/local/etc/v2ray/config.json << EOF
{
  "inbounds": [{
    "port": 10086,
    "protocol": "vmess",
    "settings": {
      "clients": [
        {
          "id": "$(cat /proc/sys/kernel/random/uuid)",
          "alterId": 0
        }
      ]
    },
    "streamSettings": {
      "network": "ws",
      "wsSettings": {
        "path": "/ray"
      }
    }
  }],
  "outbounds": [{
    "protocol": "freedom",
    "settings": {}
  }]
}
EOF

    # Start V2Ray service
    systemctl enable v2ray
    systemctl start v2ray
    
    print_success "V2Ray installed successfully"
    print_warning "V2Ray UUID: $(grep \"id\" /usr/local/etc/v2ray/config.json | cut -d\" \" -f4 | sed 's/[,\"]//g')"
}

# Install and configure DNS (AdGuard Home)
install_dns() {
    print_status "Installing AdGuard Home DNS..."
    
    # Download AdGuard Home
    cd /tmp
    wget https://static.adguard.com/adguardhome/release/AdGuardHome_linux_amd64.tar.gz
    tar xzvf AdGuardHome_linux_amd64.tar.gz
    cd AdGuardHome
    
    # Install AdGuard Home
    ./AdGuardHome -s install
    
    print_success "AdGuard Home installed successfully"
    print_warning "Access AdGuard Home admin panel at http://$(hostname -I | awk '{print $1}'):3000"
}

# Configure Web Server (Nginx)
install_webserver() {
    print_status "Installing Nginx web server..."
    
    apt install -y nginx
    systemctl enable nginx
    systemctl start nginx
    
    # Create basic HTML page
    cat > /var/www/html/index.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>VPS Setup Complete</title>
</head>
<body>
    <h1>VPS Setup Complete!</h1>
    <p>Your VPS has been successfully configured with:</p>
    <ul>
        <li>SSH Server</li>
        <li>Nginx Web Server</li>
        <li>SSL Support</li>
        <li>V2Ray Proxy</li>
        <li>DNS Server (AdGuard Home)</li>
    </ul>
</body>
</html>
EOF

    print_success "Nginx installed successfully"
}

# Configure Firewall
configure_firewall() {
    print_status "Configuring firewall..."
    
    # Reset firewall
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow essential services
    ufw allow ssh
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    ufw allow 53/tcp   # DNS TCP
    ufw allow 53/udp   # DNS UDP
    ufw allow 3000/tcp # AdGuard Home admin
    
    # Enable firewall
    ufw --force enable
    
    print_success "Firewall configured successfully"
}

# Generate setup report
generate_report() {
    local ip_address=$(hostname -I | awk '{print $1}')
    local v2ray_uuid=$(grep "id" /usr/local/etc/v2ray/config.json 2>/dev/null | cut -d'"' -f4 | head -1)
    
    print_status "Generating setup report..."
    
    cat > /root/vps_setup_report.txt << EOF
=== VPS SETUP COMPLETE ===
Date: $(date)
IP Address: $ip_address

=== SERVICES INSTALLED ===
1. SSH Server - Port 22
2. Nginx Web Server - Port 80/443
3. SSL Support (Certbot installed)
4. V2Ray Proxy - Port 10086
5. AdGuard Home DNS - Port 3000 (admin), 53 (DNS)

=== CONFIGURATION DETAILS ===
SSH: 
  - Port: 22
  - Root login: enabled
  - Key authentication: enabled

V2Ray:
  - Port: 10086
  - Protocol: VMess + WebSocket
  - UUID: $v2ray_uuid
  - WebSocket Path: /ray

DNS:
  - AdGuard Home Admin: http://$ip_address:3000
  - DNS Service: Port 53

Web Server:
  - Nginx running on port 80
  - Test page: http://$ip_address

=== NEXT STEPS ===
1. Configure your domains for SSL certificates:
   certbot --nginx -d yourdomain.com

2. Access AdGuard Home and complete setup:
   http://$ip_address:3000

3. Secure your V2Ray configuration with proper TLS

4. Consider changing SSH port and disabling root login

=== SECURITY NOTES ===
- Firewall is enabled with basic rules
- Change default passwords and keys
- Regularly update your system
- Monitor logs for suspicious activity

Log file: $LOG_FILE
EOF

    print_success "Setup complete! Report saved to: /root/vps_setup_report.txt"
    
    # Display important information
    echo
    print_warning "IMPORTANT INFORMATION:"
    echo "========================================"
    echo "V2Ray UUID: $v2ray_uuid"
    echo "AdGuard Home: http://$ip_address:3000"
    echo "Web Server: http://$ip_address"
    echo "Full report: /root/vps_setup_report.txt"
    echo "========================================"
}

# Main execution function
main() {
    print_status "Starting VPS setup script..."
    
    check_root
    update_system
    configure_ssh
    install_webserver
    install_ssl
    install_v2ray
    install_dns
    configure_firewall
    generate_report
    
    print_success "All services installed and configured successfully!"
    print_warning "Please check /root/vps_setup_report.txt for important configuration details"
}

# Run main function
main "$@"