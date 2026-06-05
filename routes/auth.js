const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    // Find rider by email in the database
    let rider = null;
    for (const r of db.riders.values()) {
      if (r.email.toLowerCase() === email.toLowerCase()) {
        rider = r;
        break;
      }
    }

    let riderId;
    if (rider) {
      riderId = rider.id;
    } else {
      // Dynamic registration/fallback to keep demo flow fully working
      riderId = 'rider_' + email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 5);
      const newRider = {
        id: riderId,
        fullName: email.split('@')[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Demo Rider',
        email: email,
        phone: '9876543' + Math.floor(100 + Math.random() * 900),
        city: 'Bangalore',
        isActive: true,
        totalPoints: 120,
        totalDeliveries: 5,
        rating: 4.8,
        joinedDate: new Date(),
        lastActive: new Date(),
        referralCode: `RW-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        referrals: 0
      };
      db.riders.set(riderId, newRider);
    }

    // Mock authentication
    const sessionId = riderId + '_' + Date.now();
    req.app.get('sessions').set(sessionId, {
      email,
      riderId,
      loginTime: new Date()
    });

    res.json({
      success: true,
      message: 'Login successful',
      sessionId,
      riderId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (sessionId) {
      req.app.get('sessions').delete(sessionId);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
