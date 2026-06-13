#!/bin/bash
echo "=== Forte Gado Git Push ==="

# Initialize Git repository
if [ ! -d ".git" ]; then
  echo "Initializing Git repository..."
  git init
else
  echo "Git repository already initialized."
fi

# Stage all files
echo "Staging files..."
git add .

# Create initial commit
echo "Committing files..."
git -c user.name="Wislley Prado" -c user.email="prado@fortegado.com.br" commit -m "feat: setup env variables, configure supabase and ignore list"

# Setup Remote Origin
echo "Setting up remote origin..."
git remote add origin https://ForteGado:1902Prado%232026@github.com/ForteGado/appvendafortegado.git || git remote set-url origin https://ForteGado:1902Prado%232026@github.com/ForteGado/appvendafortegado.git

# Push to Main branch
echo "Pushing code to GitHub..."
git branch -M main
git push -u origin main

echo "=== Sync complete! ==="
