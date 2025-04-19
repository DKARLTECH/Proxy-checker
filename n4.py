#!/usr/bin/env python3
import os
import sys
import ipaddress
import requests
import concurrent.futures
import time
import socket
import ssl
import signal
from urllib3.exceptions import ProxyError, ConnectTimeoutError

# Global variable to save results if interrupted
working_proxies = []

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def print_banner():
    clear_screen()
    print("""
    ██████╗ ██████╗  ██████╗ ██╗  ██╗██╗   ██╗██████╗  ██████╗ ██╗  ██╗
    ██╔══██╗██╔══██╗██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝██╔══██╗██╔═══██╗╚██╗██╔╝
    ██████╔╝██████╔╝██║   ██║ ╚███╔╝  ╚████╔╝ ██████╔╝██║   ██║ ╚███╔╝ 
    ██╔═══╝ ██╔══██╗██║   ██║ ██╔██╗   ╚██╔╝  ██╔═══╝ ██║   ██║ ██╔██╗ 
    ██║     ██║  ██║╚██████╔╝██╔╝ ██╗   ██║   ██║     ╚██████╔╝██╔╝ ██╗
    ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝
    ULTIMATE Proxy Scanner v2.0 | TLS 1.2 + Wide Port Scan + AutoSave
    """)

def generate_ips_from_cidr(cidr_range, ports=[80, 443, 8080, 8443, 3128, 8888, 8000, 9000, 2052, 2053, 2082, 2083, 2086, 2087, 2095, 2096]):
    """All-in-one port generator including both standard and TLS ports"""
    try:
        network = ipaddress.ip_network(cidr_range, strict=False)
        for ip in network.hosts():
            for port in ports:
                yield f"{ip}:{port}"
    except ValueError as e:
        print(f"\n[!] Invalid CIDR range: {cidr_range} - {e}")
        return []

def create_tls1_2_context():
    """Strict TLS 1.2 context matching HTTP Custom app settings"""
    context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
    context.verify_mode = ssl.CERT_NONE
    context.options |= ssl.OP_NO_SSLv3
    context.options |= ssl.OP_NO_TLSv1
    context.options |= ssl.OP_NO_TLSv1_1
    return context

def check_tls1_2_proxy(proxy, timeout=7):
    """Enhanced TLS 1.2 check with full cert extraction"""
    ip, port = proxy.split(':')
    context = create_tls1_2_context()
    
    try:
        with socket.create_connection((ip, int(port)), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=ip) as ssock:
                cipher = ssock.cipher()
                cert = ssock.getpeercert()
                
                cert_info = {}
                if cert:
                    for field in cert.get('subject', []):
                        for key, value in field:
                            cert_info[key] = value
                
                return (True, cipher, cert_info, "TLS 1.2 Strict")
    except Exception as e:
        return (False, str(e), None, None)

def test_proxy_all_methods(proxy, test_url="https://example.com", timeout=7):
    """Combined testing using all approaches"""
    # 1. Standard proxy check
    try:
        proxies = {'http': f'http://{proxy}', 'https': f'http://{proxy}'}
        response = requests.get(
            test_url,
            proxies=proxies,
            timeout=timeout,
            headers={'User-Agent': 'Mozilla/5.0'},
            allow_redirects=False
        )
        if response.status_code != 302:
            return (True, response.status_code, response.elapsed.total_seconds(), response.headers, "Standard Proxy")
    except:
        pass
    
    # 2. TLS 1.2 direct check
    tls_success, cipher, cert_info, _ = check_tls1_2_proxy(proxy, timeout)
    if tls_success:
        return (True, "TLS 1.2 OK", 0, {"Cipher": cipher, "Certificate": cert_info}, "TLS 1.2 Direct")
    
    # 3. HTTPS direct connection
    try:
        ip, port = proxy.split(':')
        if port in ('443', '8443', '2053', '2083', '2096'):
            response = requests.get(
                f"https://{ip}",
                timeout=timeout,
                verify=False,
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            if response.status_code != 302:
                return (True, response.status_code, response.elapsed.total_seconds(), response.headers, "HTTPS Direct")
    except:
        pass
    
    # 4. HTTP direct connection (for completeness)
    try:
        if not any(port in proxy for port in ['443', '8443']):
            response = requests.get(
                f"http://{proxy.split(':')[0]}",
                timeout=timeout,
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            if response.status_code != 302:
                return (True, response.status_code, response.elapsed.total_seconds(), response.headers, "HTTP Direct")
    except:
        pass
    
    return (False, "No response", 0, None, None)

def scan_proxies(cidr_ranges, max_workers=150, timeout=7):
    """Master scanning function with progress tracking"""
    global working_proxies
    total_tested = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        proxy_list = []
        for cidr in cidr_ranges:
            proxy_list.extend(generate_ips_from_cidr(cidr))
        
        if not proxy_list:
            print("\n[!] No valid proxy addresses generated")
            return []
        
        total_proxies = len(proxy_list)
        print(f"\n[•] Generated {total_proxies} proxy addresses")
        print(f"[•] Starting scan with {max_workers} threads...\n")
        print("[!] Press Ctrl+C to save partial results and exit\n")
        
        future_to_proxy = {
            executor.submit(test_proxy_all_methods, proxy, timeout=timeout): proxy 
            for proxy in proxy_list
        }
        
        for future in concurrent.futures.as_completed(future_to_proxy):
            total_tested += 1
            proxy = future_to_proxy[future]
            
            try:
                is_working, status, response_time, headers, proxy_type = future.result()
            except Exception as e:
                print(f"\033[91m[!] Error testing {proxy}: {str(e)}\033[0m")
                continue
            
            if is_working:
                working_proxies.append((proxy, status, response_time, headers, proxy_type))
                
                # Enhanced color-coded output
                if proxy_type == "TLS 1.2 Direct":
                    color = "\033[96m"  # Cyan
                    details = f"Cipher: {headers['Cipher'][0]}" if headers else ""
                elif "HTTPS" in proxy_type:
                    color = "\033[95m"  # Purple
                    details = f"Status: {status}"
                else:
                    color = "\033[92m"  # Green
                    details = f"Status: {status}"
                
                print(f"{color}[✓] {proxy.ljust(21)} | {proxy_type.ljust(16)} | {details}\033[0m")
                if headers and 'Certificate' in headers:
                    print(f"     Cert: {headers['Certificate'].get('organizationName', '')}")
            
            # Real-time progress display
            progress = f"[{total_tested}/{total_proxies}] Found: {len(working_proxies)}"
            sys.stdout.write(f"\033[K{progress}\r")
            sys.stdout.flush()
    
    return working_proxies

def save_results(proxies, filename="ultimate_proxies.txt"):
    """Enhanced results saving with timestamp"""
    with open(filename, 'w') as f:
        f.write(f"# Scan results {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"# Total working proxies: {len(proxies)}\n\n")
        
        for proxy, status, rt, headers, proxy_type in proxies:
            f.write(f"{'='*60}\n")
            f.write(f"Proxy: {proxy} | Type: {proxy_type}\n")
            f.write(f"Status: {status} | Response Time: {rt:.2f}s\n")
            
            if headers:
                if 'Cipher' in headers:
                    f.write(f"Cipher: {headers['Cipher']}\n")
                if 'Certificate' in headers:
                    f.write("Certificate Info:\n")
                    for k, v in headers['Certificate'].items():
                        f.write(f"  {k}: {v}\n")
                if 'Server' in headers:
                    f.write(f"Server: {headers['Server']}\n")
            
        print(f"\n\033[92m[+] Results saved to {filename}\033[0m")

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    print("\n\033[93m[!] Received interrupt signal. Saving results...\033[0m")
    if working_proxies:
        save_results(working_proxies, "interrupted_results.txt")
    sys.exit(0)

def main():
    global working_proxies
    print_banner()
    signal.signal(signal.SIGINT, signal_handler)
    
    # User configuration
    cidr_input = input("Enter CIDR ranges (comma separated): ").strip()
    if not cidr_input:
        print("\n[!] Please provide CIDR ranges")
        sys.exit(1)
    
    cidr_ranges = [x.strip() for x in cidr_input.split(',')]
    
    # Start scanning
    working_proxies = scan_proxies(cidr_ranges)
    
    # Save and show summary
    if working_proxies:
        save_results(working_proxies)
        
        # Detection statistics
        print("\n\033[1mDetection Summary:\033[0m")
        stats = {}
        for _, _, _, _, proxy_type in working_proxies:
            stats[proxy_type] = stats.get(proxy_type, 0) + 1
        
        for proxy_type, count in sorted(stats.items(), key=lambda x: x[1], reverse=True):
            print(f" - {proxy_type.ljust(18)}: {count} proxies")
        
        print(f"\n\033[92m[+] Total working proxies found: {len(working_proxies)}\033[0m")
    else:
        print("\n\033[91m[!] No working proxies found\033[0m")

if __name__ == '__main__':
    main()