
// This file contains the type definitions for the RailBooker application

// Train data from database
export interface TrainData {
  train_id: string;
  train_name: string;
  train_number: string;
  source: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  schedule: string;
  total_seats: number;
  available_seats: number;
  fares?: FareData[];
}

// Fare data from database
export interface FareData {
  fare_id: string;
  train_id: string;
  class: string;
  fare_amount: number;
}

// Booking data from database
export interface BookingData {
  pnr: string;
  train_id: string;
  passenger_id: string;
  fare_id: string;
  class: string;
  seat_no: string;
  booking_date: string;
  booking_status: string;
  payment_status: string;
  passenger?: {
    passenger_id: string;
    name: string;
    age: number;
    gender: string;
    contact: string;
  };
  train?: {
    train_id: string;
    train_name: string;
    train_number: string;
    source: string;
    destination: string;
    departure_time: string;
    arrival_time: string;
    schedule: string;
  };
}

// Payment data from database
export interface PaymentData {
  payment_id: string;
  pnr: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
}

// Cancellation data from database
export interface CancellationData {
  cancel_id: string;
  pnr: string;
  refund_amount: number;
  cancellation_date: string;
  status: string;
}

// Train interface for frontend
export interface Train {
  id: string;
  name: string;
  number: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: number;
  availableSeats: number;
  totalSeats: number;
  duration?: string;
  fares?: {
    id: string;
    class: string;
    amount: number;
  }[];
}

// Helper function to format time to ensure HH:MM format
const formatTimeString = (timeStr: string): string => {
  if (!timeStr) return '';
  
  // If already in HH:MM format, return as is
  if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
    return timeStr;
  }
  
  // Try to extract hours and minutes
  const timeParts = timeStr.split(':');
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0]).toString().padStart(2, '0');
    const minutes = parseInt(timeParts[1]).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  // If format is invalid, return original
  return timeStr;
};

// Helper function to map database train data to frontend Train interface
export const mapTrainDataToTrain = (trainData: TrainData): Train => {
  // Format time strings to ensure HH:MM format
  const departureTime = formatTimeString(trainData.departure_time);
  const arrivalTime = formatTimeString(trainData.arrival_time);
  
  // Calculate duration based on departure and arrival times
  const calculateDuration = (depTime: string, arrTime: string): string => {
    try {
      const [depHours, depMinutes] = depTime.split(':').map(Number);
      const [arrHours, arrMinutes] = arrTime.split(':').map(Number);
      
      let hourDiff = arrHours - depHours;
      let minuteDiff = arrMinutes - depMinutes;
      
      if (minuteDiff < 0) {
        hourDiff--;
        minuteDiff += 60;
      }
      
      if (hourDiff < 0) {
        hourDiff += 24; // Handle overnight journeys
      }
      
      return `${hourDiff}h ${minuteDiff}m`;
    } catch {
      return "Unknown";
    }
  };

  const train: Train = {
    id: trainData.train_id,
    name: trainData.train_name,
    number: trainData.train_number,
    origin: trainData.source,
    destination: trainData.destination,
    departureTime: departureTime,
    arrivalTime: arrivalTime,
    date: trainData.schedule,
    price: 0, // Will be set from fares
    availableSeats: trainData.available_seats,
    totalSeats: trainData.total_seats,
    duration: calculateDuration(departureTime, arrivalTime)
  };
  
  // Add fares if available
  if (trainData.fares && trainData.fares.length > 0) {
    // Find AC First Class fare as base price
    const acFirstFare = trainData.fares.find(fare => fare.class === 'AC First Class');
    train.price = acFirstFare ? acFirstFare.fare_amount : 1500; // Default if not found
    
    // Map fares to frontend format
    train.fares = trainData.fares.map(fare => ({
      id: fare.fare_id,
      class: fare.class,
      amount: fare.fare_amount
    }));
  } else {
    // Default price if no fares available
    train.price = 1500;
  }
  
  return train;
};
