
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTrain } from '@/services/trainService';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import BookingForm from '@/components/train/BookingForm';
import { ArrowLeft, Clock, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Train } from '@/types/railBooker';
import { supabase } from '@/integrations/supabase/client';

const BookingDetail = () => {
  const { trainId } = useParams();
  const [searchParams] = useSearchParams();
  const passengers = parseInt(searchParams.get('passengers') || '1');
  const [currentTrain, setCurrentTrain] = useState<Train | null>(null);

  const { data: train, isLoading, error, refetch } = useQuery({
    queryKey: ['train', trainId],
    queryFn: () => getTrain(trainId as string),
    enabled: !!trainId,
  });

  useEffect(() => {
    if (train) {
      setCurrentTrain(train);
    }
  }, [train]);

  // Subscribe to real-time updates for train availability
  useEffect(() => {
    if (!trainId) return;
    
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'train',
          filter: `train_id=eq.${trainId}`
        },
        (payload) => {
          console.log('Train data changed:', payload);
          refetch();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [trainId, refetch]);

  // Format time to ensure it's in HH:MM format
  const formatTime = (time: string) => {
    // If it's already in HH:MM format, return as is
    if (/^\d{1,2}:\d{2}$/.test(time)) return time;
    
    try {
      // Try to parse as a date string
      const date = new Date(`2000-01-01T${time}`);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      // If parsing fails, return original
      return time;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
        <Navbar />
        <div className="flex-grow flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-railway-600"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !currentTrain) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
        <Navbar />
        <div className="flex-grow container mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-md">
            <h3 className="font-bold text-lg mb-2">Error</h3>
            <p>Failed to load train details. Please try again later.</p>
            <Link to="/trains">
              <Button className="mt-4 bg-railway-600 hover:bg-railway-700">Return to Train Listing</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/trains" className="inline-flex items-center text-railway-600 hover:text-railway-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to train listing
          </Link>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border-t-4 border-t-railway-600">
          <h1 className="text-2xl font-bold mb-4 text-railway-800">{currentTrain.name}</h1>
          <div className="flex flex-col md:flex-row md:justify-between gap-4 border-b pb-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Train Number</p>
              <p className="font-medium">{currentTrain.number}</p>
            </div>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-gray-400" />
              <span>{currentTrain.date}</span>
            </div>
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-2 text-gray-400" />
              <span>{passengers} Passenger(s)</span>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="space-y-1 mb-4 md:mb-0">
              <div className="flex items-center">
                <div>
                  <p className="text-2xl font-bold">{formatTime(currentTrain.departureTime)}</p>
                  <p className="text-gray-500">{currentTrain.origin}</p>
                </div>
                <div className="mx-4 text-gray-400 flex items-center">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <div className="w-16 h-0.5 bg-gray-300"></div>
                  <Clock className="h-4 w-4 mx-1" />
                  <div className="w-16 h-0.5 bg-gray-300"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatTime(currentTrain.arrivalTime)}</p>
                  <p className="text-gray-500">{currentTrain.destination}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">{currentTrain.duration || "Unknown"} journey</p>
            </div>
            
            <div className="bg-gradient-to-r from-railway-50 to-white p-3 rounded-md">
              <p className="text-sm text-gray-500">Price per person</p>
              <p className="text-2xl font-bold text-railway-700">₹{currentTrain.price}</p>
              <p className="text-sm text-gray-600 mt-1">Available seats: {currentTrain.availableSeats}</p>
            </div>
          </div>
        </div>
        
        <BookingForm train={currentTrain} passengers={passengers} />
      </main>
      
      <Footer />
    </div>
  );
};

export default BookingDetail;
