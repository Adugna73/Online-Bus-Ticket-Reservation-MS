## 1.2 Beginner Setup (For Windows Users)

If you are using Windows and do not have WSL (Windows Subsystem for Linux) or Ubuntu installed, follow these steps before starting the project:

### Step 1: Install WSL and Ubuntu
1. Open PowerShell as Administrator.
2. Run this command to install WSL and Ubuntu:
	```powershell
	wsl --install
	```
3. Restart your computer if prompted.
4. After restart, open "Ubuntu" from your Start menu and let it finish setup.
5. Create a username and password when asked.

### Step 2: Update Ubuntu
In your Ubuntu terminal, run:
```bash
sudo apt update && sudo apt upgrade -y
```

### Step 3: Install Node.js (v18 or above)
In Ubuntu, run:
```bash
sudo apt install curl -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### Step 4: Install Docker (Optional, for PostgreSQL)
Follow the official guide: https://docs.docker.com/engine/install/ubuntu/

### Step 5: Continue with Project Setup
Now you can follow the rest of the instructions in this guide to set up your project!

## 1.3 Git & GitHub Setup (For Beginners)

Follow these steps to set up Git and GitHub for your project:

### Step 1: Install Git Bash (Windows Only)
1. Download Git Bash from: https://git-scm.com/downloads
2. Run the installer and follow the default options.
3. After installation, open "Git Bash" from your Start menu.

### Step 2: Create a GitHub Account
1. Go to https://github.com/
2. Click "Sign up" and follow the instructions to create your account.

### Step 3: Install Git (Linux/Ubuntu)
If you are using Ubuntu (WSL), install Git by running:
```bash
sudo apt update
sudo apt install git -y
git --version
```

### Step 4: Configure Git
Set your name and email (use the same email as your GitHub account):
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Step 5: Generate SSH Key and Add to GitHub
1. In Git Bash or Ubuntu terminal, run:
	 ```bash
	 ssh-keygen -t ed25519 -C "your@email.com"
	 ```
	 (Press Enter to accept the default file location, and set a passphrase if you want.)
2. Copy your SSH key to clipboard:
	 - On Ubuntu:
		 ```bash
		 cat ~/.ssh/id_ed25519.pub
		 ```
		 (Then select and copy the output)
	 - On Windows (Git Bash):
		 ```bash
		 clip < ~/.ssh/id_ed25519.pub
		 ```
3. Go to https://github.com/settings/keys
4. Click "New SSH key", give it a name, and paste your key, then save.

### Step 6: Test SSH Connection
Run:
```bash
ssh -T git@github.com
```
You should see a welcome message if everything is set up correctly.

## 1.4 VS Code Installation & Setup

For the best experience, use Visual Studio Code (VS Code) as your code editor. Follow these steps:

### 1. Install VS Code
- Download VS Code from: https://code.visualstudio.com/
- Run the installer and follow the instructions.

### 2. Install Important Extensions
Open VS Code, go to the Extensions view (left sidebar or press `Ctrl+Shift+X`), and search for and install these extensions:
- ESLint (dbaeumer.vscode-eslint)
- Prettier - Code formatter (esbenp.prettier-vscode)
- Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)
- shadcn/ui (shadcn.vscode-shadcn-ui)
- Prisma (Prisma.prisma)
- Docker (ms-azuretools.vscode-docker)
- GitHub Pull Requests and Issues (GitHub.vscode-pull-request-github)
- GitLens — Git supercharged (eamodio.gitlens)
- GitHub Copilot (GitHub.copilot)

### 3. Enable GitHub Copilot
- After installing the GitHub Copilot extension, sign in with your GitHub account when prompted.
- If you do not have a Copilot subscription, you may need to start a free trial or request access through your school.
- Once enabled, Copilot will suggest code as you type. Accept suggestions with `Tab` or review alternatives with `Ctrl+Space`.
- Use Copilot to help you learn, write, and understand code faster!

## 1.5 API Testing Tools (Postman or Thunder Client)

To test your backend APIs, you can use either Postman (a standalone app) or Thunder Client (a VS Code extension):

### Option 1: Postman
- Download Postman from: https://www.postman.com/downloads/
- Install and launch the app.
- Use it to send requests to your API endpoints and view responses.

### Option 2: Thunder Client (VS Code Extension)
- Open VS Code and go to the Extensions view (`Ctrl+Shift+X`).
- Search for "Thunder Client" and install it.
- Use Thunder Client inside VS Code to test your API endpoints easily.

Both tools are beginner-friendly and help you check if your backend is working correctly.


## 1.5 API Testing Tools (Postman or Thunder Client)

To test your backend APIs, you can use either Postman (a standalone app) or Thunder Client (a VS Code extension):

### Option 1: Postman
- Download Postman from: https://www.postman.com/downloads/
- Install and launch the app.
- Use it to send requests to your API endpoints and view responses.

### Option 2: Thunder Client (VS Code Extension)
- Open VS Code and go to the Extensions view (`Ctrl+Shift+X`).
- Search for "Thunder Client" and install it.
- Use Thunder Client inside VS Code to test your API endpoints easily.

Both tools are beginner-friendly and help you check if your backend is working correctly.

# Online-Bus-Ticket-Reservation-MS: Project Collaboration Guide

Welcome to the Online-Bus-Ticket-Reservation-MS project!

This document is your step-by-step guide for building the Online-Bus-Ticket-Reservation-MS system, from the very beginning to the final submission. Follow each section carefully, and work together as a team to learn, code, and collaborate throughout the project.

You will:
- Learn how to set up a real-world project from scratch
- Practice coding together and reading each other's code
- Document your progress and questions
- Prepare for your final graduation project submission

Ask questions, help each other, and enjoy the learning process!

## 1. Project Overview
- **Project Name:** Online-Bus-Ticket-Reservation-MS
- **Purpose:** A web-based system for reserving bus tickets online, designed as a final graduation project for computer science students.
- **Tech Stack:**
	- Next.js
	- TypeScript
	- Node.js
	- PostgreSQL
	- Docker
	- Zod (validation)
	- shadcn/ui (UI components)
	- Tailwind CSS

## 1.1 Tech Stack Setup Instructions

Follow these steps to set up each technology in your project:

### Next.js & TypeScript
- Already included in the project initialization step.

### Node.js
- Make sure Node.js (v18 or above) is installed on your computer.
- Check with:
	```bash
	node -v
	```

### PostgreSQL
- Install PostgreSQL on your machine or use a cloud provider (like Supabase or Railway).
- For local setup, follow the official guide: https://www.postgresql.org/download/

### Docker
- Install Docker Desktop from https://www.docker.com/products/docker-desktop/
- You will use Docker to run PostgreSQL and possibly for deploying your app.

### Tailwind CSS
- After initializing your Next.js project, install Tailwind CSS:
	```bash
	npm install -D tailwindcss postcss autoprefixer
	npx tailwindcss init -p
	```
- Follow the official guide to configure Tailwind: https://tailwindcss.com/docs/guides/nextjs

### shadcn/ui
- Install shadcn/ui components:
	```bash
	npx shadcn-ui@latest init
	```
- See docs: https://ui.shadcn.com/docs/installation/next

### Zod
- Install Zod for schema validation:
	```bash
	npm install zod
	```

---

## 2. Important Linux Commands for Beginners

Here are some basic Linux commands you will use often during this project:

| Command | Description |
|---------|-------------|
| `ls` | List files and folders in the current directory |
| `cd foldername` | Change directory to `foldername` |
| `cd ..` | Go up one directory |
| `pwd` | Show the current directory path |
| `mkdir foldername` | Create a new folder named `foldername` |
| `rm filename` | Delete a file named `filename` |
| `rm -r foldername` | Delete a folder and its contents |
| `cp source dest` | Copy a file from `source` to `dest` |
| `mv source dest` | Move or rename a file or folder |
| `touch filename` | Create a new empty file named `filename` |
| `code .` | Open the current folder in VS Code |
| `clear` | Clear the terminal screen |

**Tip:** You can always type `man command` (e.g., `man ls`) to see the manual for any command.

## 2. Team Collaboration Steps

### Step 1: Project Initialization
- [ ] Create an empty project folder
	- Open your terminal.
	- Navigate to the location where you want to create your project (e.g., Desktop or Documents):
		```bash
		cd ~/projects
		```
	- Create a new folder for your project:
		```bash
		mkdir Online-Bus-Ticket-Reservation-MS
		cd Online-Bus-Ticket-Reservation-MS
		```
	- You should now be inside your new, empty project folder.
- [ ] Initialize a Next.js project with TypeScript
	- Open your terminal in the project folder and run:
		```bash
		npx create-next-app@latest . --use-npm --typescript --no-tailwind --eslint
		```
- [ ] Set up version control (Git)

### Step 2: Requirement Analysis
- [ ] Review the proposal and requirements document (to be provided)
- [ ] List and discuss all system features

### Step 3: System Design
- [ ] Design folder structure and main components
- [ ] Create wireframes or UI mockups
- [ ] Plan database schema (if needed)

### Step 4: Implementation (Pair Programming)
- [ ] Set up basic pages and navigation
- [ ] Implement authentication (login, signup)
- [ ] Add core features (search, booking, payment, etc.)
- [ ] Test each feature as you go

### Step 5: Documentation
- [ ] Document code and features in markdown files
- [ ] Prepare user and technical documentation

### Step 6: Final Review & Submission
- [ ] Review all code as a team
- [ ] Test the system end-to-end
- [ ] Prepare final report and presentation

## 3. How to Use This Guide
- Use this file as a checklist during your Zoom meetings.
- Add notes, code snippets, and questions as you work.
- Assign tasks to team members and track progress.

## 4. Next Steps
- Wait for the proposal/requirement document to be added.
- Once received, update this file with detailed requirements and break down tasks further.

---

> **Tip:** Always ask questions and discuss code together. This will help everyone improve their coding and code reading skills!
