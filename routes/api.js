const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Centralized in-memory database
const db = require('../database/db');

// Validation middleware
const validatePhone = (phone) => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Auto-segment tagging logic
function computeSegmentTags(data) {
  const tags = [];
  const vType = (data.vehicleType || '').toLowerCase();
  const openToEV = data.openToEV || '';
  const hasAccidental = data.hasAccidentalInsurance || '';
  const hasHealth = data.hasHealthInsurance || '';
  const interests = data.interests || '';

  // Vehicle type based
  if (vType.includes('electric')) {
    tags.push('EV Rider');
  } else if (vType.includes('petrol') || vType.includes('diesel')) {
    tags.push('Petrol Rider');
  }

  // EV openness
  if (['Yes', 'Need more information'].includes(openToEV) && !vType.includes('electric')) {
    tags.push('Swing Rider');
    tags.push('Hot EV Lead');
  }

  // Insurance leads
  if (hasAccidental === 'No' || hasAccidental === 'Not sure' || hasHealth === 'No' || hasHealth === 'Not sure') {
    tags.push('Insurance Lead');
  }

  // Retrofit interest
  if (interests && (interests.includes('Retrofit') || interests === 'All of the above')) {
    tags.push('Retrofit Lead');
  }

  return [...new Set(tags)]; // deduplicate
}

// Generate referral code in format RW-XXXX
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'RW-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Check milestone bonuses for referrer
function checkMilestoneBonuses(referrer) {
  const milestones = [];
  const refs = referrer.referrals;
  
  if (refs === 10 && !referrer.milestone10) {
    referrer.totalPoints += 100;
    referrer.milestone10 = true;
    milestones.push({ milestone: 10, bonus: 100, type: 'badge', message: `🎉 Congrats ${referrer.fullName}! You've referred 10 riders! +100 bonus points added. You earned a Road Warrior Badge!` });
  }
  if (refs === 25 && !referrer.milestone25) {
    referrer.totalPoints += 300;
    referrer.milestone25 = true;
    milestones.push({ milestone: 25, bonus: 300, type: 'milestone', message: `🏆 Amazing ${referrer.fullName}! 25 referrals achieved! +300 bonus points. You are a Road Warrior Champion!` });
  }
  if (refs === 50 && !referrer.milestone50) {
    referrer.totalPoints += 500;
    referrer.milestone50 = true;
    milestones.push({ milestone: 50, bonus: 500, type: 'luckydraw', message: `🚀 LEGEND! ${referrer.fullName} has referred 50 riders! +500 points & entered into the Lucky Draw!` });
  }
  
  return milestones;
}

// Check duplicate by phone
router.get('/riders/check-phone/:phone', (req, res) => {
  try {
    const { phone } = req.params;
    let exists = false;
    let riderName = null;
    for (let rider of db.riders.values()) {
      if (rider.phone === phone) {
        exists = true;
        riderName = rider.fullName;
        break;
      }
    }
    res.json({ success: true, exists, riderName });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get rider by phone (for score lookup)
router.get('/riders/by-phone/:phone', (req, res) => {
  try {
    const { phone } = req.params;
    let foundRider = null;
    for (let rider of db.riders.values()) {
      if (rider.phone === phone) {
        foundRider = rider;
        break;
      }
    }
    if (!foundRider) {
      return res.status(404).json({ success: false, error: 'Rider not found with this phone number' });
    }
    res.json({ success: true, data: foundRider });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create/Register Rider - Full Questionnaire (Sections A-F)
router.post('/riders/register', (req, res) => {
  try {
    const {
      // Section A
      fullName, phone, city, deliveryPlatform, experienceYears,
      // Auth
      email, password,
      // Section B
      vehicleType, vehicleModel, fuelMethod, fuelExpenseWeekly, maintenanceExpenseMonthly,
      // Section C
      challenges, evChallenges, petrolChallenges,
      // Section D
      hasAccidentalInsurance, hasHealthInsurance, paidOutofPocketAccident,
      // Section E
      openToEV, switchTriggers, interests,
      // Section F
      referredByCode,
      // Language preference
      language
    } = req.body;

    // Validation
    if (!fullName || !phone || !city) {
      return res.status(400).json({ success: false, error: 'Full name, phone, and city are required' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ success: false, error: 'Phone must be exactly 10 digits' });
    }

    // Check duplicate phone
    for (let rider of db.riders.values()) {
      if (rider.phone === phone) {
        return res.status(400).json({ success: false, error: 'Phone number already registered. You can check your score at the Score page.' });
      }
    }

    // Check duplicate email if provided
    if (email) {
      for (let rider of db.riders.values()) {
        if (rider.email === email) {
          return res.status(400).json({ success: false, error: 'Email already registered' });
        }
      }
    }

    // Compute auto tags
    const tags = computeSegmentTags({ vehicleType, openToEV, hasAccidentalInsurance, hasHealthInsurance, interests });

    // Process referral code if provided
    let milestones = [];
    if (referredByCode) {
      for (let referrer of db.riders.values()) {
        if (referrer.referralCode === referredByCode) {
          referrer.referrals = (referrer.referrals || 0) + 1;
          referrer.totalPoints = (referrer.totalPoints || 0) + 5; // +5 per successful referral
          milestones = checkMilestoneBonuses(referrer);
          db.riders.set(referrer.id, referrer);
          break;
        }
      }
    }

    const riderId = uuidv4();
    const referralCode = generateReferralCode();

    const rider = {
      id: riderId,
      fullName,
      email: email || `${phone}@roadwarrior.local`,
      phone,
      city,
      deliveryPlatform: deliveryPlatform || '',
      experienceYears: parseInt(experienceYears) || 0,
      isActive: true,
      totalPoints: 10, // Every new rider starts with 10 points
      totalDeliveries: 0,
      rating: 5.0,
      joinedDate: new Date(),
      lastActive: new Date(),
      referralCode,
      referrals: 0,
      // Section B
      vehicleType: vehicleType || '',
      vehicleModel: vehicleModel || '',
      fuelMethod: fuelMethod || '',
      fuelExpenseWeekly: parseFloat(fuelExpenseWeekly) || 0,
      maintenanceExpenseMonthly: parseFloat(maintenanceExpenseMonthly) || 0,
      // Section C
      challenges: Array.isArray(challenges) ? challenges : [],
      evChallenges: Array.isArray(evChallenges) ? evChallenges : [],
      petrolChallenges: Array.isArray(petrolChallenges) ? petrolChallenges : [],
      // Section D
      hasAccidentalInsurance: hasAccidentalInsurance || '',
      hasHealthInsurance: hasHealthInsurance || '',
      paidOutofPocketAccident: paidOutofPocketAccident || '',
      // Section E
      openToEV: openToEV || '',
      switchTriggers: Array.isArray(switchTriggers) ? switchTriggers : [],
      interests: interests || '',
      // Section F
      referredByCode: referredByCode || null,
      // Tags
      tags,
      language: language || 'en',
      registeredAt: new Date()
    };

    db.riders.set(riderId, rider);

    // Build WhatsApp confirmation message in preferred language
    let whatsappMessage = '';
    if (language === 'hi') {
      whatsappMessage = `Namaste ${fullName} bhai! Aapka registration ho gaya. Aapka referral code hai: ${referralCode}. Is code ko apne doston ke saath share karo aur points kamao. Road Warrior bano!`;
    } else if (language === 'kn') {
      whatsappMessage = `Namaskara ${fullName}! Nimma nondane aayitu. Nimma referral code: ${referralCode}. Ee code annu nimma sneharitara share madi mattu points gaLisi. Road Warrior aagi!`;
    } else {
      whatsappMessage = `Welcome ${fullName}! You are now registered. Your referral code is ${referralCode}. Share it with other riders to earn points and rewards. Road Warrior — let's go!`;
    }

    res.json({
      success: true,
      message: 'Rider registered successfully',
      data: { riderId, rider },
      sessionId: riderId,
      referralCode,
      whatsappMessage,
      milestones
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Rider Profile
router.get('/riders/:riderId', (req, res) => {
  try {
    const { riderId } = req.params;
    const rider = db.riders.get(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }
    res.json({ success: true, data: rider });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Rider Profile
router.put('/riders/:riderId', (req, res) => {
  try {
    const { riderId } = req.params;
    const rider = db.riders.get(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }

    const { fullName, phone, city, profileImage } = req.body;
    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ success: false, error: 'Phone must be exactly 10 digits' });
    }

    if (fullName) rider.fullName = fullName;
    if (phone) rider.phone = phone;
    if (city) rider.city = city;
    if (profileImage) rider.profileImage = profileImage;
    rider.lastActive = new Date();

    db.riders.set(riderId, rider);
    res.json({ success: true, message: 'Profile updated successfully', data: rider });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add Vehicle
router.post('/vehicles', (req, res) => {
  try {
    const { riderId, vehicleType, licensePlate, color, make, model } = req.body;
    if (!riderId || !vehicleType || !licensePlate) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const rider = db.riders.get(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }

    const vehicleId = uuidv4();
    const vehicle = {
      id: vehicleId, riderId, vehicleType,
      licensePlate: licensePlate.toUpperCase(), color, make, model,
      registrationDate: new Date(), status: 'active', mileage: 0, fuelType: 'petrol',
      insurance: { provider: '', expiryDate: null, policyNumber: '' }
    };

    db.vehicles.set(vehicleId, vehicle);
    res.json({ success: true, message: 'Vehicle added successfully', data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Rider Vehicles
router.get('/riders/:riderId/vehicles', (req, res) => {
  try {
    const { riderId } = req.params;
    const vehicles = [];
    for (let vehicle of db.vehicles.values()) {
      if (vehicle.riderId === riderId) vehicles.push(vehicle);
    }
    res.json({ success: true, data: vehicles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create Delivery
router.post('/deliveries', (req, res) => {
  try {
    const { riderId, pickupLocation, dropoffLocation, deliveryType, amount } = req.body;
    if (!riderId || !pickupLocation || !dropoffLocation) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const rider = db.riders.get(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }

    const deliveryId = uuidv4();
    const delivery = {
      id: deliveryId, riderId, pickupLocation, dropoffLocation,
      deliveryType: deliveryType || 'food', amount: amount || 50,
      status: 'pending', createdAt: new Date(),
      startTime: null, endTime: null, distance: 0, duration: 0, rating: null
    };

    db.deliveries.set(deliveryId, delivery);
    rider.totalDeliveries += 1;
    res.json({ success: true, message: 'Delivery created successfully', data: delivery });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Delivery Status
router.put('/deliveries/:deliveryId', (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { status, rating } = req.body;
    const delivery = db.deliveries.get(deliveryId);
    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    if (status === 'completed') {
      delivery.endTime = new Date();
      const rider = db.riders.get(delivery.riderId);
      if (rider) {
        rider.totalPoints += Math.floor(delivery.amount / 10);
        rider.lastActive = new Date();
      }
    }

    if (status) delivery.status = status;
    if (rating) delivery.rating = rating;
    db.deliveries.set(deliveryId, delivery);
    res.json({ success: true, message: 'Delivery updated successfully', data: delivery });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Rider Deliveries
router.get('/riders/:riderId/deliveries', (req, res) => {
  try {
    const { riderId } = req.params;
    const deliveries = [];
    for (let delivery of db.deliveries.values()) {
      if (delivery.riderId === riderId) deliveries.push(delivery);
    }
    res.json({ success: true, data: deliveries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get All Riders (Admin)
router.get('/admin/riders', (req, res) => {
  try {
    const riders = Array.from(db.riders.values());
    res.json({ success: true, data: riders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get EV Leads
router.get('/admin/leads/ev', (req, res) => {
  try {
    const evLeads = Array.from(db.riders.values()).filter(r =>
      r.openToEV === 'Yes' || r.openToEV === 'Need more information' || (r.tags && r.tags.includes('Hot EV Lead'))
    );
    res.json({ success: true, data: evLeads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get Insurance Leads
router.get('/admin/leads/insurance', (req, res) => {
  try {
    const insLeads = Array.from(db.riders.values()).filter(r =>
      r.hasAccidentalInsurance === 'No' || r.hasAccidentalInsurance === 'Not sure' ||
      r.hasHealthInsurance === 'No' || r.hasHealthInsurance === 'Not sure' ||
      (r.tags && r.tags.includes('Insurance Lead'))
    );
    res.json({ success: true, data: insLeads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get vehicle type stats
router.get('/admin/vehicle-stats', (req, res) => {
  try {
    const riders = Array.from(db.riders.values());
    const stats = { petrol: 0, electric: 0, diesel: 0, other: 0 };
    riders.forEach(r => {
      const vt = (r.vehicleType || '').toLowerCase();
      if (vt.includes('electric')) stats.electric++;
      else if (vt.includes('petrol')) stats.petrol++;
      else if (vt.includes('diesel')) stats.diesel++;
      else stats.other++;
    });
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: City breakdown
router.get('/admin/city-stats', (req, res) => {
  try {
    const riders = Array.from(db.riders.values());
    const cityMap = {};
    riders.forEach(r => {
      const city = r.city || 'Unknown';
      if (!cityMap[city]) cityMap[city] = 0;
      cityMap[city]++;
    });
    const data = Object.entries(cityMap).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Leaderboard
router.get('/leaderboard', (req, res) => {
  try {
    const riders = Array.from(db.riders.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 100)
      .map((rider, index) => ({ rank: index + 1, ...rider }));
    res.json({ success: true, data: riders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Statistics
router.get('/stats/:riderId', (req, res) => {
  try {
    const { riderId } = req.params;
    const rider = db.riders.get(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }

    const deliveries = [];
    for (let delivery of db.deliveries.values()) {
      if (delivery.riderId === riderId) deliveries.push(delivery);
    }

    const completedDeliveries = deliveries.filter(d => d.status === 'completed');
    const totalEarnings = completedDeliveries.reduce((sum, d) => sum + (d.amount || 0), 0);

    const stats = {
      totalDeliveries: rider.totalDeliveries,
      completedDeliveries: completedDeliveries.length,
      totalEarnings,
      totalPoints: rider.totalPoints,
      rating: rider.rating,
      joinedDate: rider.joinedDate,
      referrals: rider.referrals,
      referralCode: rider.referralCode,
      tags: rider.tags || [],
      acceptanceRate: rider.totalDeliveries > 0 ? (completedDeliveries.length / rider.totalDeliveries * 100).toFixed(2) : 0,
      averageRating: deliveries.filter(d => d.rating).length > 0
        ? (deliveries.filter(d => d.rating).reduce((sum, d) => sum + d.rating, 0) / deliveries.filter(d => d.rating).length).toFixed(2)
        : 5.0
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health Check
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'API is running', timestamp: new Date() });
});

module.exports = router;
