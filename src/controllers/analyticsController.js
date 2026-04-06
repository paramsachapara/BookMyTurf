const Booking = require("../models/BookingModel");

/**
 * Get booking analytics within a date range
 * Query params: startDate, endDate (YYYY-MM-DD format)
 */
exports.getBookingAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, clubId } = req.query;

    // Validate date parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required (YYYY-MM-DD format)"
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Set time to start of day for start date and end of day for end date
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD"
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "startDate must be before or equal to endDate"
      });
    }

    // Build match query
    const matchQuery = {
      bookingDate: { $gte: start, $lte: end }
    };

    // Filter by club if club owner or if clubId is provided
    if (req.user.role === "club_owner") {
      matchQuery.clubId = req.user.clubId;
    } else if (clubId && (req.user.role === "super_admin" || req.user.role === "admin")) {
      matchQuery.clubId = clubId;
    }

    // Get all bookings in the date range with yard details
    const bookings = await Booking.find(matchQuery)
      .populate('yardIds', 'name gameType')
      .populate('yardId', 'name gameType')
      .lean();

    // Calculate analytics
    const analytics = {
      dateRange: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      totalBookings: bookings.length,
      totalIncome: 0,
      bookingStatusCounts: {
        confirmed: 0,
        cancelled: 0
      },
      paymentStatusCounts: {
        pending: 0,
        paid: 0,
        failed: 0
      },
      settlementCounts: {
        settled: 0,
        unsettled: 0
      },
      advancePaymentCounts: {
        withAdvance: 0,
        withoutAdvance: 0
      },
      incomeBreakdown: {
        advancePayments: 0,
        settlementPayments: 0,
        totalCollected: 0,
        pendingAmount: 0,
        addOnRevenue: 0  // Add-on revenue tracking
      },
      totalAdvanceAmount: 0  // Add this field
    };

    // Initialize yard-wise statistics
    const yardStats = {};
    
    // Process each booking
    bookings.forEach(booking => {
      // Count booking statuses
      if (booking.bookingStatus === "confirmed") {
        analytics.bookingStatusCounts.confirmed++;
      } else if (booking.bookingStatus === "cancelled") {
        analytics.bookingStatusCounts.cancelled++;
      }

      // Count payment statuses
      analytics.paymentStatusCounts[booking.paymentStatus]++;

      // Count settlement status
      if (booking.settlementDone) {
        analytics.settlementCounts.settled++;
      } else {
        analytics.settlementCounts.unsettled++;
      }

      // Count advance payments
      if (booking.advancePaymentReceived) {
        analytics.advancePaymentCounts.withAdvance++;
      } else {
        analytics.advancePaymentCounts.withoutAdvance++;
      }

      // Calculate income
      const addOns = booking.addOns || [];
      const addOnRevenue = addOns.reduce((sum, addOn) => sum + (addOn.price * addOn.quantity), 0);
      const finalAmount = (booking.totalAmount || 0) - (booking.negotiatedDiscount || 0) + addOnRevenue;
      analytics.totalIncome += finalAmount;
      
      // Add-on revenue tracking
      analytics.incomeBreakdown.addOnRevenue = (analytics.incomeBreakdown.addOnRevenue || 0) + addOnRevenue;
      
      // Calculate pending amount (for paid bookings that aren't fully collected)
      if (booking.paymentStatus === "paid" && (booking.advancePaymentOnline + booking.advancePaymentCash + booking.settlementRemainingOnline + booking.settlementRemainingCash) < finalAmount) {
        analytics.incomeBreakdown.pendingAmount += (finalAmount - (booking.advancePaymentOnline + booking.advancePaymentCash + booking.settlementRemainingOnline + booking.settlementRemainingCash));
      } else if (booking.paymentStatus === "pending") {
        analytics.incomeBreakdown.pendingAmount += finalAmount;
      }
      
      // Income breakdown
      const advanceOnline = booking.advancePaymentOnline || 0;
      const advanceCash = booking.advancePaymentCash || 0;
      const settlementOnline = booking.settlementRemainingOnline || 0;
      const settlementCash = booking.settlementRemainingCash || 0;
      
      const totalAdvance = advanceOnline + advanceCash;
      const totalSettlement = settlementOnline + settlementCash;
      const totalCollected = totalAdvance + totalSettlement;
      
      analytics.incomeBreakdown.advancePayments += totalAdvance;
      analytics.incomeBreakdown.settlementPayments += totalSettlement;
      analytics.incomeBreakdown.totalCollected += totalCollected;
      
      if (booking.paymentStatus === "paid" && totalCollected < finalAmount) {
        analytics.incomeBreakdown.pendingAmount += (finalAmount - totalCollected);
      } else if (booking.paymentStatus === "pending") {
        analytics.incomeBreakdown.pendingAmount += finalAmount;
      }
      
      // Process yard-wise statistics
      const yardsInBooking = booking.yardIds && booking.yardIds.length > 0 ? booking.yardIds : (booking.yardId ? [booking.yardId] : []);
      const incomePerYard = yardsInBooking.length > 0 ? finalAmount / yardsInBooking.length : finalAmount;
      
      yardsInBooking.forEach(yard => {
        const yardId = yard._id ? yard._id.toString() : yard.toString();
        const yardName = yard.name || 'Unknown Yard';
        
        if (!yardStats[yardId]) {
          yardStats[yardId] = {
            yardId,
            yardName,
            totalBookings: 0,
            totalIncome: 0,
            confirmedBookings: 0,
            cancelledBookings: 0,
            settledBookings: 0,
            pendingBookings: 0,
            paidBookings: 0,
            averageBookingValue: 0,
            // Enhanced payment breakdown
            advancePayments: 0,
            settlementPayments: 0,
            totalCollected: 0,
            pendingAmount: 0,
            withAdvancePayments: 0,
            withoutAdvancePayments: 0,
            // Add-on tracking
            addOnRevenue: 0,
            addOnCount: 0
          };
        }
        
        // Update yard statistics
        yardStats[yardId].totalBookings++;
        yardStats[yardId].totalIncome += incomePerYard;
        
        // Calculate add-on revenue for this yard
        const addOns = booking.addOns || [];
        const addOnRevenue = addOns.reduce((sum, addOn) => {
          return sum + (addOn.price * addOn.quantity);
        }, 0) / yardsInBooking.length;
        
        yardStats[yardId].addOnRevenue += addOnRevenue;
        // Count booking with add-ons (only count once per booking, not per add-on)
        if (addOns.length > 0) {
          yardStats[yardId].addOnCount++;
        }
        
        // Enhanced payment tracking per yard
        const advanceOnline = (booking.advancePaymentOnline || 0) / yardsInBooking.length;
        const advanceCash = (booking.advancePaymentCash || 0) / yardsInBooking.length;
        const settlementOnline = (booking.settlementRemainingOnline || 0) / yardsInBooking.length;
        const settlementCash = (booking.settlementRemainingCash || 0) / yardsInBooking.length;
        
        const totalAdvance = advanceOnline + advanceCash;
        const totalSettlement = settlementOnline + settlementCash;
        const totalCollected = totalAdvance + totalSettlement;
        
        yardStats[yardId].advancePayments += totalAdvance;
        yardStats[yardId].settlementPayments += totalSettlement;
        yardStats[yardId].totalCollected += totalCollected;
        
        if (booking.advancePaymentReceived) {
          yardStats[yardId].withAdvancePayments++;
        } else {
          yardStats[yardId].withoutAdvancePayments++;
        }
        
        // Calculate pending amount for this yard
        if (booking.paymentStatus === "paid" && totalCollected < incomePerYard) {
          yardStats[yardId].pendingAmount += (incomePerYard - totalCollected);
        } else if (booking.paymentStatus === "pending") {
          yardStats[yardId].pendingAmount += incomePerYard;
        }
        
        if (booking.bookingStatus === "confirmed") {
          yardStats[yardId].confirmedBookings++;
        } else if (booking.bookingStatus === "cancelled") {
          yardStats[yardId].cancelledBookings++;
        }
        
        if (booking.settlementDone) {
          yardStats[yardId].settledBookings++;
        }
        
        if (booking.paymentStatus === "pending") {
          yardStats[yardId].pendingBookings++;
        } else if (booking.paymentStatus === "paid") {
          yardStats[yardId].paidBookings++;
        }
      });
    });
    
    // Calculate averages for each yard
    Object.values(yardStats).forEach(yard => {
      yard.averageBookingValue = yard.totalBookings > 0 ? 
        Math.round(yard.totalIncome / yard.totalBookings * 100) / 100 : 0;
    });
    
    // Convert to array and sort by income (highest first)
    analytics.yardWiseStats = Object.values(yardStats).sort((a, b) => b.totalIncome - a.totalIncome);
    
    // Calculate overall advance amount from all yards and add to existing totalAdvanceAmount
    const totalAdvanceAmount = Object.values(yardStats).reduce((sum, yard) => sum + (yard.advancePayments || 0), 0);
    analytics.totalAdvanceAmount += totalAdvanceAmount;

    // Additional calculated metrics
    analytics.averageBookingValue = analytics.totalBookings > 0 ? 
      Math.round(analytics.totalIncome / analytics.totalBookings * 100) / 100 : 0;
    
    analytics.settlementRate = analytics.totalBookings > 0 ? 
      Math.round((analytics.settlementCounts.settled / analytics.totalBookings) * 100 * 100) / 100 : 0;
    
    analytics.cancellationRate = analytics.totalBookings > 0 ? 
      Math.round((analytics.bookingStatusCounts.cancelled / analytics.totalBookings) * 100 * 100) / 100 : 0;

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate analytics",
      error: error.message
    });
  }
};

/**
 * Get daily booking trends within a date range
 */
exports.getDailyTrends = async (req, res) => {
  try {
    const { startDate, endDate, clubId } = req.query;

    // Validate date parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required (YYYY-MM-DD format)"
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD"
      });
    }

    // Build match query
    const matchQuery = {
      bookingDate: { $gte: start, $lte: end }
    };

    if (req.user.role === "club_owner") {
      matchQuery.clubId = req.user.clubId;
    } else if (clubId && (req.user.role === "super_admin" || req.user.role === "admin")) {
      matchQuery.clubId = clubId;
    }

    // Get detailed daily data with yard information
    const bookings = await Booking.find(matchQuery)
      .populate('yardIds', 'name gameType')
      .populate('yardId', 'name gameType')
      .sort({ bookingDate: 1 })
      .lean();

    // Group by date and calculate yard-wise statistics
    const dailyData = {};
    
    bookings.forEach(booking => {
      const dateStr = booking.bookingDate.toISOString().split('T')[0];
      const finalAmount = (booking.totalAmount || 0) - (booking.negotiatedDiscount || 0);
      const yardsInBooking = booking.yardIds && booking.yardIds.length > 0 ? booking.yardIds : (booking.yardId ? [booking.yardId] : []);
      const incomePerYard = yardsInBooking.length > 0 ? finalAmount / yardsInBooking.length : finalAmount;
      
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = {
          date: dateStr,
          totalBookings: 0,
          totalIncome: 0,
          confirmedBookings: 0,
          cancelledBookings: 0,
          settledBookings: 0,
          paidBookings: 0,
          yardWiseStats: {},
          bookings: []
        };
      }
      
      // Update daily totals
      dailyData[dateStr].totalBookings++;
      const addOns = booking.addOns || [];
      const addOnRevenue = addOns.reduce((sum, addOn) => sum + (addOn.price * addOn.quantity), 0);
      dailyData[dateStr].totalIncome += finalAmount + addOnRevenue;
      
      if (booking.bookingStatus === "confirmed") {
        dailyData[dateStr].confirmedBookings++;
      } else if (booking.bookingStatus === "cancelled") {
        dailyData[dateStr].cancelledBookings++;
      }
      
      if (booking.settlementDone) {
        dailyData[dateStr].settledBookings++;
      }
      
      if (booking.paymentStatus === "paid") {
        dailyData[dateStr].paidBookings++;
      }
      
      // Process yard-wise statistics for this date
      yardsInBooking.forEach(yard => {
        const yardId = yard._id ? yard._id.toString() : yard.toString();
        const yardName = yard.name || 'Unknown Yard';
        
        if (!dailyData[dateStr].yardWiseStats[yardId]) {
          dailyData[dateStr].yardWiseStats[yardId] = {
            yardId,
            yardName,
            totalBookings: 0,
            totalIncome: 0,
            confirmedBookings: 0,
            cancelledBookings: 0,
            settledBookings: 0,
            paidBookings: 0,
            // Enhanced payment breakdown
            advancePayments: 0,
            settlementPayments: 0,
            totalCollected: 0,
            pendingAmount: 0,
            withAdvancePayments: 0,
            withoutAdvancePayments: 0,
            // Add-on tracking
            addOnRevenue: 0,
            addOnCount: 0
          };
        }
        
        // Update yard statistics for this date
        const yardStat = dailyData[dateStr].yardWiseStats[yardId];
        yardStat.totalBookings++;
        yardStat.totalIncome += incomePerYard;
        
        // Calculate add-on revenue for this yard and date
        const addOns = booking.addOns || [];
        const addOnRevenue = addOns.reduce((sum, addOn) => {
          return sum + (addOn.price * addOn.quantity);
        }, 0) / yardsInBooking.length;
        
        yardStat.addOnRevenue += addOnRevenue;
        // Count booking with add-ons (only count once per booking, not per add-on)
        if (addOns.length > 0) {
          yardStat.addOnCount++;
        }
        
        // Enhanced payment tracking per yard for this date
        const advanceOnline = (booking.advancePaymentOnline || 0) / yardsInBooking.length;
        const advanceCash = (booking.advancePaymentCash || 0) / yardsInBooking.length;
        const settlementOnline = (booking.settlementRemainingOnline || 0) / yardsInBooking.length;
        const settlementCash = (booking.settlementRemainingCash || 0) / yardsInBooking.length;
        
        const totalAdvance = advanceOnline + advanceCash;
        const totalSettlement = settlementOnline + settlementCash;
        const totalCollected = totalAdvance + totalSettlement;
        
        yardStat.advancePayments += totalAdvance;
        yardStat.settlementPayments += totalSettlement;
        yardStat.totalCollected += totalCollected;
        
        if (booking.advancePaymentReceived) {
          yardStat.withAdvancePayments++;
        } else {
          yardStat.withoutAdvancePayments++;
        }
        
        // Calculate pending amount for this yard
        if (booking.paymentStatus === "paid" && totalCollected < incomePerYard) {
          yardStat.pendingAmount += (incomePerYard - totalCollected);
        } else if (booking.paymentStatus === "pending") {
          yardStat.pendingAmount += incomePerYard;
        }
        
        if (booking.bookingStatus === "confirmed") {
          yardStat.confirmedBookings++;
        } else if (booking.bookingStatus === "cancelled") {
          yardStat.cancelledBookings++;
        }
        
        if (booking.settlementDone) {
          yardStat.settledBookings++;
        }
        
        if (booking.paymentStatus === "paid") {
          yardStat.paidBookings++;
        }
      });
      
      // Add detailed booking information
      dailyData[dateStr].bookings.push({
        bookingId: booking._id,
        userName: booking.userName,
        mobileNumber: booking.mobileNumber,
        start_time: booking.start_time,
        end_time: booking.end_time,
        yards: yardsInBooking.map(y => ({
          yardId: y._id || y,
          yardName: y.name || 'Unknown Yard'
        })),
        totalAmount: finalAmount,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        settlementDone: booking.settlementDone,
        advancePaymentReceived: booking.advancePaymentReceived
      });
    });
    
    // Convert to array and sort yard-wise stats by income for each date
    const dailyStats = Object.values(dailyData).map(day => {
      day.yardWiseStats = Object.values(day.yardWiseStats).sort((a, b) => b.totalIncome - a.totalIncome);
      
      // Calculate total advance amount for this date
      const totalAdvanceAmount = Object.values(day.yardWiseStats).reduce((sum, yard) => sum + yard.advancePayments, 0);
      day.totalAdvanceAmount = totalAdvanceAmount;
      
      // Calculate total add-on revenue for this date
      const totalAddOnRevenue = Object.values(day.yardWiseStats).reduce((sum, yard) => sum + yard.addOnRevenue, 0);
      day.totalAddOnRevenue = totalAddOnRevenue;
      
      return day;
    }).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        dateRange: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        },
        dailyStats
      }
    });

  } catch (error) {
    console.error("Daily Trends Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate daily trends",
      error: error.message
    });
  }
};
