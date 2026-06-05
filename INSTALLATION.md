# 📦 Installation Instructions

## System Requirements

- **Node.js**: v14 or higher
- **npm**: v6 or higher (comes with Node.js)
- **RAM**: 512MB minimum
- **Disk Space**: 100MB
- **Browser**: Modern browser (Chrome, Firefox, Safari, Edge)
- **OS**: Windows, Mac, Linux

## Step-by-Step Installation

### 1. Download & Extract

```bash
# Download the file (if not already done)
# Extract the zip file
unzip road-warrior-pro-complete.zip

# Navigate to project directory
cd road-warrior-pro

# Verify files
ls -la
```

**Expected files:**
```
.env
.gitignore
README.md
SETUP.md
package.json
server.js
public/
  ├── index.html
  ├── vehicles.html
  ├── dashboard.html
  ├── profile.html
  ├── score.html
  ├── admin.html
  └── css/
      └── style.css
routes/
  ├── api.js
  ├── auth.js
  └── dashboard.js
```

### 2. Install Dependencies

```bash
# Install all required npm packages
npm install

# Verify installation
npm list

# Expected output should show all dependencies installed
```

**Installation may take 2-3 minutes depending on internet speed.**

### 3. Verify Installation

```bash
# Check Node version
node --version
# Should be v14 or higher

# Check npm version
npm --version
# Should be v6 or higher

# Check dependencies
npm list --depth=0
# Should list: express, cors, dotenv, uuid, etc.
```

### 4. Start the Server

```bash
# Start with npm
npm start

# You should see:
# ╔════════════════════════════════════════════════════════════════╗
# ║                                                                ║
# ║   🚗 ROAD WARRIOR PRO - Delivery Management System             ║
# ║   ═══════════════════════════════════════════════════════════  ║
# ║                                                                ║
# ║   Server is running at: http://localhost:3000                 ║
# ║   Environment: development                                    ║
# ║   Version: 2.0.0                                              ║
# ║                                                                ║
# ╚════════════════════════════════════════════════════════════════╝
```

### 5. Open in Browser

1. Open your web browser
2. Go to: `http://localhost:3000`
3. You should see the Road Warrior Pro login page
4. Test by registering a new account

## Configuration

### Edit .env File

Open `.env` in a text editor to customize:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Timeouts
API_TIMEOUT=30000
SESSION_TIMEOUT=86400

# Debug Mode
DEBUG=false

# Change these for production
SESSION_SECRET=your_secret_key_here
```

### Change Port (if 3000 is busy)

**Option 1: Command line**
```bash
PORT=3001 npm start
```

**Option 2: Edit .env**
```env
PORT=3001
```

## Troubleshooting Installation

### Error: "npm: command not found"

**Solution:** Node.js is not installed
```bash
# Download from: https://nodejs.org/
# Install and restart terminal
# Verify: node --version
```

### Error: "Port 3000 already in use"

**Solution:**
```bash
# Kill process using port 3000
# On Mac/Linux:
lsof -ti:3000 | xargs kill -9

# Or use different port:
PORT=3001 npm start
```

### Error: "Cannot find module"

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Error: "EACCES: permission denied"

**Solution:**
```bash
# On Mac/Linux, use sudo
sudo npm install

# Or fix npm permissions:
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

## Updating the Application

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update all packages
npm update

# Update specific package
npm update express
```

### Backup Your Data

```bash
# Before updating
cp -r road-warrior-pro road-warrior-pro-backup

# After updating, if issues:
rm -rf road-warrior-pro
mv road-warrior-pro-backup road-warrior-pro
```

## Performance Tips

### 1. Clear Cache
```bash
# Clear npm cache
npm cache clean --force

# Clear browser cache
# Chrome: Ctrl+Shift+Del
# Firefox: Ctrl+Shift+Del
# Safari: Cmd+Option+E
```

### 2. Optimize for Production
```bash
# Install only production dependencies
npm install --production

# Minify CSS and JavaScript
npm install -g csso-cli
```

### 3. Monitor Performance
```bash
# Check server logs
tail -f logs/app.log

# Check resource usage
top # Linux/Mac
taskmgr # Windows
```

## Database Setup (For Production)

### Using Supabase (Recommended)

1. Create account at https://supabase.com
2. Create new project
3. Get credentials from project settings
4. Update .env:
   ```env
   SUPABASE_URL=your_url
   SUPABASE_KEY=your_key
   DB_HOST=your_host
   DB_NAME=your_db
   DB_USER=your_user
   DB_PASSWORD=your_password
   ```

### Using PostgreSQL

1. Install PostgreSQL
2. Create database:
   ```sql
   CREATE DATABASE road_warrior;
   CREATE USER rw_user WITH PASSWORD 'password';
   ```
3. Configure connection in .env
4. Run migrations (if available)

## Security Setup

### 1. Change Default Secrets
```env
SESSION_SECRET=generate_random_string_here
```

### 2. Enable HTTPS
```bash
# Get SSL certificate
# Use Let's Encrypt (free)
# https://letsencrypt.org/
```

### 3. Set Strong Passwords
```bash
# For database user
CREATE USER admin WITH PASSWORD 'strong_password_here';
```

### 4. Configure CORS
Edit `server.js`:
```javascript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

## Deployment

### Deploy to Heroku

```bash
# Install Heroku CLI
# Login
heroku login

# Create app
heroku create your-app-name

# Set environment
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Deploy to DigitalOcean

1. Create Droplet (Ubuntu 20.04)
2. SSH into server
3. Install Node.js and npm
4. Clone project
5. Run: `npm start`
6. Use PM2 for process management

```bash
npm install -g pm2
pm2 start server.js
pm2 save
```

## Verification Checklist

- [ ] Node.js installed (v14+)
- [ ] npm installed (v6+)
- [ ] Dependencies installed (`npm install`)
- [ ] Server starts without errors (`npm start`)
- [ ] Browser opens to `http://localhost:3000`
- [ ] All pages load correctly
- [ ] Phone validation works
- [ ] Forms submit successfully
- [ ] No console errors (F12)
- [ ] Database connection configured (if using DB)

## Next Steps

1. Read the README.md for complete documentation
2. Follow SETUP.md for quick start
3. Test all features
4. Customize for your needs
5. Deploy to production

---

**Installation Complete!** 🎉

Your Road Warrior Pro instance is ready to use.
