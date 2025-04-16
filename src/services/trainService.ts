
import { supabase } from '@/integrations/supabase/client';
import { TrainData, FareData, mapTrainDataToTrain, Train, BookingData, PaymentData, CancellationData } from '@/types/railBooker';
import { toast } from 'sonner';

// Format time to ensure HH:MM format
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

// Get all trains
export const getTrains = async (params?: { 
  origin?: string, 
  destination?: string, 
  date?: string
}): Promise<Train[]> => {
  let query = supabase.from('train').select(`
    *,
    fares:fare(*)
  `);
  
  // Apply filters if provided
  if (params?.origin) {
    query = query.ilike('source', `%${params.origin}%`);
  }
  
  if (params?.destination) {
    query = query.ilike('destination', `%${params.destination}%`);
  }
  
  if (params?.date) {
    query = query.eq('schedule', params.date);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching trains:', error);
    throw new Error(`Failed to fetch trains: ${error.message}`);
  }
  
  // Type assertion to tell TypeScript we know the shape of the data
  return (data as unknown as TrainData[]).map(train => mapTrainDataToTrain(train));
};

// Get a train by ID
export const getTrain = async (trainId: string): Promise<Train | null> => {
  const { data, error } = await supabase
    .from('train')
    .select(`
      *,
      fares:fare(*)
    `)
    .eq('train_id', trainId)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching train:', error);
    throw new Error(`Failed to fetch train: ${error.message}`);
  }
  
  if (!data) return null;
  
  // Type assertion to tell TypeScript we know the shape of the data
  return mapTrainDataToTrain(data as unknown as TrainData);
};

// Get train fares
export const getTrainFares = async (trainId: string): Promise<FareData[]> => {
  const { data, error } = await supabase
    .from('fare')
    .select('*')
    .eq('train_id', trainId);
  
  if (error) {
    console.error('Error fetching fares:', error);
    throw new Error(`Failed to fetch fares: ${error.message}`);
  }
  
  // Type assertion to tell TypeScript we know the shape of the data
  return data as unknown as FareData[];
};

// Create a booking
export const createBooking = async (bookingData: {
  passengerData: {
    name: string;
    age: number;
    gender: string;
    contact: string;
  }[];
  trainId: string;
  fareClass: string;
  paymentMethod: string;
  totalAmount: number;
}): Promise<string> => {
  try {
    // Check if train has enough seats
    const { data: trainData, error: trainError } = await supabase
      .from('train')
      .select('available_seats, total_seats')
      .eq('train_id', bookingData.trainId)
      .single();
    
    if (trainError) throw trainError;
    
    if (trainData.available_seats < bookingData.passengerData.length) {
      throw new Error(`Not enough seats available. Only ${trainData.available_seats} seats left.`);
    }
    
    // Step 1: Insert passenger data and get IDs
    const passengerIds: string[] = [];
    
    for (const passenger of bookingData.passengerData) {
      const { data: passengerData, error: passengerError } = await supabase
        .from('passenger')
        .insert({
          name: passenger.name,
          age: passenger.age,
          gender: passenger.gender,
          contact: passenger.contact
        })
        .select('passenger_id')
        .single();
      
      if (passengerError) throw passengerError;
      
      passengerIds.push(passengerData.passenger_id);
    }
    
    // Step 2: Get the fare_id for the selected class
    let fareId: string;
    
    try {
      const { data: fareData, error: fareError } = await supabase
        .from('fare')
        .select('fare_id')
        .eq('train_id', bookingData.trainId)
        .eq('class', bookingData.fareClass)
        .single();
        
      if (fareError) throw fareError;
      fareId = fareData.fare_id;
    } catch (error) {
      console.error('Error fetching fare, trying fallback:', error);
      // If no exact match, use any fare for this train
      const { data: anyFare, error: anyFareError } = await supabase
        .from('fare')
        .select('fare_id')
        .eq('train_id', bookingData.trainId)
        .limit(1)
        .single();
        
      if (anyFareError) throw anyFareError;
      fareId = anyFare.fare_id;
    }
    
    // Step 3: Create bookings for each passenger
    const bookings: string[] = [];
    let firstPnr = '';
    
    for (let i = 0; i < passengerIds.length; i++) {
      // Assign random seat numbers (in a real app, this would be more sophisticated)
      const seatNo = `${bookingData.fareClass[0]}${Math.floor(Math.random() * 90) + 10}`;
      
      const { data: bookingResult, error: bookingError } = await supabase
        .from('booking')
        .insert({
          passenger_id: passengerIds[i],
          train_id: bookingData.trainId,
          fare_id: fareId,
          class: bookingData.fareClass,
          seat_no: seatNo,
          booking_status: 'Confirmed'
        })
        .select('pnr')
        .single();
      
      if (bookingError) throw bookingError;
      
      bookings.push(bookingResult.pnr);
      if (i === 0) firstPnr = bookingResult.pnr;
    }
    
    // Step 4: Create payment record
    const { error: paymentError } = await supabase
      .from('payment')
      .insert({
        pnr: firstPnr,
        amount: bookingData.totalAmount,
        payment_method: bookingData.paymentMethod,
        status: 'Successful' // Assume payment is successful immediately for simplicity
      });
    
    if (paymentError) throw paymentError;
    
    // The triggers will handle updating available seats and revenue
    // But let's also decrement seats here to ensure UI is updated immediately
    const { error: seatUpdateError } = await supabase.rpc('decrement', {
      row_id: bookingData.trainId,
      value: bookingData.passengerData.length
    });
    
    if (seatUpdateError) {
      console.error('Warning: Seat decrement function error:', seatUpdateError);
      // Don't throw here, as the booking was successful and triggers should handle it
    }
    
    return firstPnr;
  } catch (error: any) {
    console.error('Error creating booking:', error);
    toast.error('Failed to create booking: ' + error.message);
    throw error;
  }
};

// Get all bookings
export const getBookings = async (): Promise<BookingData[]> => {
  const { data, error } = await supabase
    .from('booking')
    .select(`
      *,
      passenger:passenger(*),
      train:train(*)
    `)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching bookings:', error);
    throw new Error(`Failed to fetch bookings: ${error.message}`);
  }
  
  return data as unknown as BookingData[];
};

// Get all cancellations
export const getCancellations = async (): Promise<CancellationData[]> => {
  const { data, error } = await supabase
    .from('cancellation')
    .select('*')
    .order('cancellation_date', { ascending: false });
  
  if (error) {
    console.error('Error fetching cancellations:', error);
    throw new Error(`Failed to fetch cancellations: ${error.message}`);
  }
  
  return data as unknown as CancellationData[];
};

// Cancel a booking
export const cancelBooking = async (pnr: string, amount: number): Promise<void> => {
  try {
    // Get booking info to determine train and passenger count
    const { data: bookingData, error: bookingFetchError } = await supabase
      .from('booking')
      .select('train_id, booking_status')
      .eq('pnr', pnr)
      .single();
    
    if (bookingFetchError) throw bookingFetchError;
    
    // Only proceed if the booking is currently confirmed
    if (bookingData.booking_status === 'Confirmed') {
      // Step 1: Update booking status
      const { error: bookingError } = await supabase
        .from('booking')
        .update({ booking_status: 'Cancelled' })
        .eq('pnr', pnr);
      
      if (bookingError) throw bookingError;
      
      // Step 2: Create cancellation record
      const refundAmount = amount * 0.9; // 10% cancellation fee
      
      const { error: cancellationError } = await supabase
        .from('cancellation')
        .insert({
          pnr,
          refund_amount: refundAmount,
          status: 'Processed'
        });
      
      if (cancellationError) throw cancellationError;
      
      // Step 3: Increment available seats
      const { error: seatUpdateError } = await supabase.rpc('increment', {
        row_id: bookingData.train_id,
        value: 1 // Assuming one passenger per booking for simplicity
      });
      
      if (seatUpdateError) {
        console.error('Warning: Seat increment function error:', seatUpdateError);
        // Don't throw here, as the cancellation was successful and triggers should handle it
      }
      
      toast.success('Booking cancelled successfully. Refund of ₹' + refundAmount.toFixed(2) + ' will be processed.');
    } else {
      toast.info('This booking has already been cancelled.');
    }
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    toast.error('Failed to cancel booking: ' + error.message);
    throw error;
  }
};

// Admin functions
export const getAdminData = async (): Promise<{ totalRevenue: number }> => {
  const { data, error } = await supabase
    .from('admin')
    .select('total_revenue')
    .single();
  
  if (error) {
    console.error('Error fetching admin data:', error);
    return { totalRevenue: 0 }; // Default value if error
  }
  
  return { totalRevenue: data?.total_revenue || 0 };
};

// Add a new train (admin only)
export const addTrain = async (trainData: {
  name: string;
  number: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: string;
  availableSeats: string;
}): Promise<void> => {
  try {
    // Format time strings to ensure HH:MM format
    const formattedDepartureTime = formatTimeString(trainData.departureTime);
    const formattedArrivalTime = formatTimeString(trainData.arrivalTime);
    
    console.log('Adding train with data:', {
      ...trainData,
      departureTime: formattedDepartureTime,
      arrivalTime: formattedArrivalTime
    });
    
    // Step 1: Insert train data
    const { data: newTrain, error: trainError } = await supabase
      .from('train')
      .insert({
        train_name: trainData.name,
        train_number: trainData.number,
        source: trainData.origin,
        destination: trainData.destination,
        departure_time: formattedDepartureTime,
        arrival_time: formattedArrivalTime,
        schedule: trainData.date,
        total_seats: Number(trainData.availableSeats),
        available_seats: Number(trainData.availableSeats)
      })
      .select('train_id')
      .single();
    
    if (trainError) {
      console.error('Error adding train:', trainError);
      throw trainError;
    }
    
    console.log('Train added successfully:', newTrain);
    
    // Step 2: Insert fare data
    const fareAmount = Number(trainData.price);
    const fareClasses = [
      { class: 'AC First Class', multiplier: 1.0 },
      { class: 'AC 2 Tier', multiplier: 0.8 },
      { class: 'AC 3 Tier', multiplier: 0.6 },
      { class: 'Sleeper', multiplier: 0.4 }
    ];
    
    const fareData = fareClasses.map(fare => ({
      train_id: newTrain.train_id,
      class: fare.class,
      fare_amount: Math.round(fareAmount * fare.multiplier)
    }));
    
    const { error: fareError } = await supabase
      .from('fare')
      .insert(fareData);
    
    if (fareError) {
      console.error('Error adding fares:', fareError);
      throw fareError;
    }
    
    toast.success('Train added successfully');
  } catch (error: any) {
    console.error('Error adding train:', error);
    toast.error('Failed to add train: ' + error.message);
    throw error;
  }
};

// Update an existing train (admin only)
export const updateTrain = async (trainData: {
  id: string;
  name: string;
  number: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: string;
  availableSeats: string;
}): Promise<void> => {
  try {
    // Format time strings to ensure HH:MM format
    const formattedDepartureTime = formatTimeString(trainData.departureTime);
    const formattedArrivalTime = formatTimeString(trainData.arrivalTime);
    
    console.log('Updating train with data:', {
      ...trainData,
      departureTime: formattedDepartureTime,
      arrivalTime: formattedArrivalTime
    });
    
    // Step 1: Update train data
    const { error: trainError } = await supabase
      .from('train')
      .update({
        train_name: trainData.name,
        train_number: trainData.number,
        source: trainData.origin,
        destination: trainData.destination,
        departure_time: formattedDepartureTime,
        arrival_time: formattedArrivalTime,
        schedule: trainData.date,
        total_seats: Number(trainData.availableSeats),
        available_seats: Number(trainData.availableSeats)
      })
      .eq('train_id', trainData.id);
    
    if (trainError) {
      console.error('Error updating train:', trainError);
      throw trainError;
    }
    
    // Step 2: Update fare data
    const fareAmount = Number(trainData.price);
    
    // Get existing fares
    const { data: existingFares, error: faresFetchError } = await supabase
      .from('fare')
      .select('fare_id, class')
      .eq('train_id', trainData.id);
    
    if (faresFetchError) {
      console.error('Error fetching fares:', faresFetchError);
      throw faresFetchError;
    }
    
    // Update each fare with correct multiplier
    const fareClasses: Record<string, number> = {
      'AC First Class': 1.0,
      'AC 2 Tier': 0.8,
      'AC 3 Tier': 0.6,
      'Sleeper': 0.4
    };
    
    for (const fare of existingFares || []) {
      const multiplier = fareClasses[fare.class as keyof typeof fareClasses] || 1.0;
      
      const { error: fareUpdateError } = await supabase
        .from('fare')
        .update({
          fare_amount: Math.round(fareAmount * multiplier)
        })
        .eq('fare_id', fare.fare_id);
      
      if (fareUpdateError) {
        console.error(`Error updating fare for ${fare.class}:`, fareUpdateError);
        // Continue with other fares even if one fails
      }
    }
    
    toast.success('Train updated successfully');
  } catch (error: any) {
    console.error('Error updating train:', error);
    toast.error('Failed to update train: ' + error.message);
    throw error;
  }
};

// Delete a train (admin only)
export const deleteTrain = async (trainId: string): Promise<void> => {
  try {
    // Check if train has associated bookings
    const { count, error: countError } = await supabase
      .from('booking')
      .select('*', { count: 'exact', head: true })
      .eq('train_id', trainId);
    
    if (countError) throw countError;
    
    if (count && count > 0) {
      throw new Error(`Cannot delete train with ${count} existing bookings`);
    }
    
    // Delete all associated fares first
    const { error: fareDeleteError } = await supabase
      .from('fare')
      .delete()
      .eq('train_id', trainId);
    
    if (fareDeleteError) throw fareDeleteError;
    
    // Delete the train
    const { error: trainDeleteError } = await supabase
      .from('train')
      .delete()
      .eq('train_id', trainId);
    
    if (trainDeleteError) throw trainDeleteError;
    
    toast.success('Train deleted successfully');
  } catch (error: any) {
    console.error('Error deleting train:', error);
    toast.error('Failed to delete train: ' + error.message);
    throw error;
  }
};
