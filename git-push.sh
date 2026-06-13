#!/bin/bash
echo "=== Forte Gado Git Push ==="

# Staging files
echo "Staging files..."
git add .

# Committing files
echo "Committing files..."
git -c user.name="Wislley Prado" -c user.email="prado@fortegado.com.br" commit -m "feat: setup env variables, configure supabase and ignore list" --allow-empty

# Try to push via SSH first
echo "Attempting to push via SSH (Recommended)..."
git remote add origin git@github.com:ForteGado/appvendafortegado.git || git remote set-url origin git@github.com:ForteGado/appvendafortegado.git
git branch -M main

if git push -u origin main; then
  echo "=== Success! Code pushed via SSH ==="
  exit 0
else
  echo ""
  echo "SSH authentication failed or not configured on this machine."
  echo "Trying HTTPS Personal Access Token..."
fi

# Fallback to Personal Access Token (PAT)
echo "-------------------------------------------------------------------"
echo "GitHub has disabled account passwords for git push operations."
echo "Please enter a Personal Access Token (PAT)."
echo "To generate a new token:"
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Click 'Generate new token' (classic)"
echo "3. Give it a name and select the 'repo' scope"
echo "4. Copy the generated token"
echo "-------------------------------------------------------------------"
read -p "Paste your GitHub Personal Access Token: " token
echo ""

if [ -z "$token" ]; then
  echo "Token cannot be empty. Cancelled."
  exit 1
fi

# Configure HTTPS with Token
git remote set-url origin "https://ForteGado:${token}@github.com/ForteGado/appvendafortegado.git"

echo "Pushing code to GitHub using token..."
if git push -u origin main; then
  echo "=== Success! Code pushed via Token ==="
else
  echo "Failed to push even with token. Please check your token scopes."
fi
