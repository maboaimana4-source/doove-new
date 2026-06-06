import os
import requests
import sys

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO_OWNER = "maboaimana4-source"
REPO_NAME = "doove-new"
DOWNLOAD_DIR = "/root/doove-recast/apps/landing/dist/downloads"

def sync_releases():
    print(f"Checking for latest releases from {REPO_OWNER}/{REPO_NAME}...")
    headers = {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"
    
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Error fetching release: {response.status_code}")
        print(response.text)
        return

    release_data = response.json()
    tag_name = release_data.get('tag_name')
    if not tag_name:
        print("No release tag found.")
        return
        
    assets = release_data.get('assets', [])
    
    if not os.path.exists(DOWNLOAD_DIR):
        os.makedirs(DOWNLOAD_DIR)

    print(f"Found release {tag_name}. Downloading assets...")

    for asset in assets:
        name = asset['name']
        download_url = asset['browser_download_url']
        
        # We only care about the main binaries
        if not (name.endswith('.exe') or name.endswith('.dmg') or name.endswith('.AppImage')):
            continue
            
        # Target local names for the landing page
        if '.exe' in name:
            local_name = "Doove-windows-x64.exe"
        elif '.dmg' in name:
            local_name = "Doove-macos-x64.dmg"
        elif '.AppImage' in name:
            local_name = "Doove-linux-x64.AppImage"
        else:
            continue

        local_path = os.path.join(DOWNLOAD_DIR, local_name)
        print(f"Downloading {name} -> {local_name}...")
        
        # Stream the download
        asset_res = requests.get(download_url, headers=headers, stream=True)
        if asset_res.status_code == 200:
            with open(local_path, 'wb') as f:
                for chunk in asset_res.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Successfully downloaded {local_name}")
        else:
            print(f"Failed to download {name}: {asset_res.status_code}")

if __name__ == "__main__":
    sync_releases()
