import paramiko
import sys
import io
import os

# Set default encoding to UTF-8 for print
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def run_setup(host, port, user, password, local_zip):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {host}...")
        client.connect(host, port=port, username=user, password=password, timeout=10)
        
        # 1. Clean up and install prerequisites
        cmds = [
            "export DEBIAN_FRONTEND=noninteractive",
            "apt-get update && apt-get install -y docker.io docker-compose-v2 git curl unzip",
            "systemctl start docker && systemctl enable docker",
            "service nginx stop || true",
            "pkill -9 nginx || true",
            "cd /opt/orbisporte && docker compose -f docker-compose.prod.yml down || true",
            "rm -rf /opt/orbisporte",
            "mkdir -p /opt/orbisporte"
        ]
        for cmd in cmds:
            print(f"Executing: {cmd}")
            stdin, stdout, stderr = client.exec_command(cmd)
            stdout.channel.recv_exit_status()
            
        # 2. Upload the zip file
        print("Uploading source code...")
        sftp = client.open_sftp()
        sftp.put(local_zip, "/opt/orbisporte/orbisporte.zip")
        sftp.close()
        
        # 3. Extract and Run
        cmds = [
            "cd /opt/orbisporte && unzip -o orbisporte.zip -d .",
            "cd /opt/orbisporte && (test -f .env || cp .env.example .env)",
            "cd /opt/orbisporte && docker compose -f docker-compose.prod.yml up -d --build --remove-orphans"
        ]
        for cmd in cmds:
            print(f"Executing: {cmd}")
            stdin, stdout, stderr = client.exec_command(cmd)
            # Read output for feedback
            for line in stdout: print(f"  [OUT] {line.strip()}")
            for line in stderr: print(f"  [ERR] {line.strip()}")
            stdout.channel.recv_exit_status()
            
        print("Deployment completed successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    HOST = "89.167.78.89"
    USER = "root"
    PASS = "Spectra@123"
    LOCAL_ZIP = r"d:\Orbisporte-main\Orbisporte-main\orbisporte.zip"
    
    run_setup(HOST, 22, USER, PASS, LOCAL_ZIP)
