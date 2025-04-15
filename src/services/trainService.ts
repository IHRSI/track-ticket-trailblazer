
import { supabase } from '@/integrations/supabase/client';
import { TrainData, FareData, mapTrainDataToTrain, Train, BookingData, PaymentData, CancellationData } from '@/types/railBooker';
import { toast } from 'sonner';

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
    // Using a different approach to avoid reassigning a const variable
    let fareId: string;
    
    const { data: fareData, error: fareError } = await supabase
      .from('fare')
      .select('fare_id')
      .eq('train_id', bookingData.trainId)
      .eq('class', bookingData.fareClass)
      .single();
      
    if (fareError) {
      console.error('Error fetching fare:', fareError);
      // If no exact match, use any fare for this train
      const { data: anyFare, error: anyFareError } = await supabase
        .from('fare')
        .select('fare_id')
        .eq('train_id', bookingData.trainId)
        .limit(1)
        .single();
        
      if (anyFareError) throw anyFareError;
      fareId = anyFare.fare_id;
    } else {
      fareId = fareData.fare_id;
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

// Cancel a booking
export const cancelBooking = async (pnr: string, amount: number): Promise<void> => {
  try {
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
    
    toast.success('Booking cancelled successfully. Refund of ₹' + refundAmount.toFixed(2) + ' will be processed.');
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
    throw new Error(`Failed to fetch admin data: ${error.message}`);
  }
  
  return { totalRevenue: data.total_revenue || 0 };
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
    console.log('Adding train with data:', trainData);
    
    // Step 1: Insert train data
    const { data: newTrain, error: trainError } = await supabase
      .from('train')
      .insert({
        train_name: trainData.name,
        train_number: trainData.number,
        source: trainData.origin,
        destination: trainData.destination,
        departure_time: trainData.departureTime,
        arrival_time: trainData.arrivalTime,
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
