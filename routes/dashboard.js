const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Helper to get days of week
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Dashboard analytics (Evaluates actual database details combined with seed/mock fallbacks)
router.get('/analytics/:riderId', (req, res) => {
  try {
    const { riderId } = req.params;
    
    // Find actual deliveries for this rider
    const actualDeliveries = [];
    for (let delivery of db.deliveries.values()) {
      if (delivery.riderId === riderId) {
        actualDeliveries.push(delivery);
      }
    }

    const completedDeliveries = actualDeliveries.filter(d => d.status === 'completed');
    
    // Map of day of week to actual stats
    const dayStats = {};
    DAYS.forEach(day => {
      dayStats[day] = { deliveries: 0, earnings: 0, distance: 0 };
    });

    // Populate actuals
    completedDeliveries.forEach(d => {
      // Find day index
      const date = new Date(d.endTime || d.createdAt);
      const dayName = DAYS[(date.getDay() + 6) % 7]; // Convert Sunday=0 to Monday=0
      dayStats[dayName].deliveries += 1;
      dayStats[dayName].earnings += d.amount || 0;
      dayStats[dayName].distance += d.distance || 5;
    });

    // Generate weekly data: if there are no actuals, use mock base data.
    // If there are actuals, overlay them on top of a baseline so the chart is always visually rich.
    const weeklyData = DAYS.map((day, idx) => {
      // Base mock values
      const baseDeliveries = [5, 8, 12, 7, 9, 14, 10][idx];
      const baseEarnings = [300, 450, 680, 400, 520, 800, 580][idx];
      const baseDistance = [15, 24, 38, 22, 28, 45, 32][idx];

      return {
        day,
        deliveries: baseDeliveries + dayStats[day].deliveries,
        earnings: baseEarnings + dayStats[day].earnings,
        distance: parseFloat((baseDistance + dayStats[day].distance).toFixed(1))
      };
    });

    // Calculate this week totals
    const actualEarningsSum = completedDeliveries.reduce((sum, d) => sum + (d.amount || 0), 0);
    const actualDistanceSum = completedDeliveries.reduce((sum, d) => sum + (d.distance || 0), 0);
    const actualRatings = completedDeliveries.filter(d => d.rating);
    const avgRating = actualRatings.length > 0
      ? parseFloat((actualRatings.reduce((sum, d) => sum + d.rating, 0) / actualRatings.length).toFixed(2))
      : 4.8;

    const baseWeeklyDeliveries = 65;
    const baseWeeklyEarnings = 3730;
    const baseWeeklyDistance = 204;

    const analytics = {
      weeklyData,
      dailyHeatmap: Array.from({length: 24}, (_, hour) => {
        // High density during lunch (12-14) and dinner (19-21)
        const isPeak = (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21);
        return {
          hour: `${hour}:00`,
          deliveries: dayStats[DAYS[new Date().getDay()]]?.deliveries + (isPeak ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 2)),
          active: isPeak || Math.random() > 0.4
        };
      }),
      thisWeek: {
        deliveries: baseWeeklyDeliveries + completedDeliveries.length,
        earnings: baseWeeklyEarnings + actualEarningsSum,
        distance: parseFloat((baseWeeklyDistance + actualDistanceSum).toFixed(1)),
        rating: avgRating
      },
      comparison: {
        previousWeek: 60,
        change: parseFloat((( (baseWeeklyDeliveries + completedDeliveries.length - 60) / 60 ) * 100).toFixed(1))
      }
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get city-wise analytics
router.get('/city-analytics', (req, res) => {
  try {
    // Count active deliveries per city in DB
    const cityCounts = {
      Bangalore: 1250,
      Mumbai: 980,
      Delhi: 1100,
      Pune: 850,
      Hyderabad: 920
    };

    // Increment based on actual registered riders in DB
    for (let rider of db.riders.values()) {
      if (cityCounts[rider.city] !== undefined) {
        cityCounts[rider.city] += rider.totalDeliveries || 0;
      }
    }

    const cities = Object.keys(cityCounts).map(name => ({
      name,
      deliveries: cityCounts[name],
      rating: parseFloat((4.5 + Math.random() * 0.4).toFixed(1))
    }));

    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get revenue analytics
router.get('/revenue/:riderId', (req, res) => {
  try {
    const { riderId } = req.params;

    // Filter actual deliveries
    const actualDeliveries = [];
    for (let delivery of db.deliveries.values()) {
      if (delivery.riderId === riderId && delivery.status === 'completed') {
        actualDeliveries.push(delivery);
      }
    }

    const currentMonthIdx = new Date().getMonth();
    const monthStats = {};
    MONTHS.forEach(m => {
      monthStats[m] = { revenue: 0, deliveries: 0 };
    });

    actualDeliveries.forEach(d => {
      const date = new Date(d.endTime || d.createdAt);
      const monthName = MONTHS[date.getMonth()];
      monthStats[monthName].revenue += d.amount || 0;
      monthStats[monthName].deliveries += 1;
    });

    const revenueData = MONTHS.map((month, idx) => {
      // Mock history for previous months, add actuals to the current month
      const isPast = idx < currentMonthIdx;
      const isCurrent = idx === currentMonthIdx;

      let baseRevenue = isPast ? Math.floor(Math.random() * 2000) + 1500 : 0;
      let baseDeliveries = isPast ? Math.floor(baseRevenue / 40) : 0;

      return {
        month,
        revenue: baseRevenue + monthStats[month].revenue,
        deliveries: baseDeliveries + monthStats[month].deliveries
      };
    });

    res.json({
      success: true,
      data: revenueData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get system-wide statistics (Admin Dashboard)
router.get('/system-stats', (req, res) => {
  try {
    const ridersCount = db.riders.size;
    let activeRidersCount = 0;
    let totalDeliveriesCount = 0;
    let totalEarningsCount = 0;
    let ratingsSum = 0;
    let ratingsCount = 0;

    for (let rider of db.riders.values()) {
      if (rider.isActive) activeRidersCount++;
      totalDeliveriesCount += rider.totalDeliveries || 0;
      totalEarningsCount += (rider.totalDeliveries || 0) * 50; // Average earnings
      if (rider.rating) {
        ratingsSum += rider.rating;
        ratingsCount++;
      }
    }

    // Blend with platform seed statistics (to simulate large database metrics)
    const stats = {
      totalRiders: 2450 + ridersCount,
      activeRiders: 850 + activeRidersCount,
      totalDeliveries: 125000 + totalDeliveriesCount,
      totalEarnings: 2400000 + totalEarningsCount,
      averageRating: ratingsCount > 0 ? (ratingsSum / ratingsCount).toFixed(1) : '4.8',
      topCity: 'Bangalore',
      peakHours: ['12:00 PM', '7:00 PM'],
      averageDeliveryTime: '24 mins',
      successRate: '96.2%'
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
