
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from 'sonner';
import { Train } from '@/types/railBooker';
import { createBooking } from '@/services/trainService';
import { supabase } from '@/integrations/supabase/client';

interface BookingFormProps {
  train: Train;
  passengers: number;
}

const BookingForm: React.FC<BookingFormProps> = ({ train, passengers }) => {
  const [passengerDetails, setPassengerDetails] = useState(
    Array(Number(passengers)).fill({
      name: '',
      age: '',
      gender: 'male'
    })
  );
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const updatePassenger = (index: number, field: string, value: string) => {
    const updatedPassengers = [...passengerDetails];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };
    setPassengerDetails(updatedPassengers);
  };

  const validateForm = () => {
    const validPassengers = passengerDetails.every(p => 
      p.name && p.age && parseInt(p.age.toString()) > 0 && p.gender
    );
    
    if (!validPassengers) {
      toast.error("Please fill in all passenger details");
      return false;
    }
    
    if (!contactEmail || !contactPhone) {
      toast.error("Please provide contact information");
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    
    if (contactPhone.length < 10) {
      toast.error("Please enter a valid phone number");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (train.availableSeats < passengers) {
      toast.error(`Not enough seats available. Only ${train.availableSeats} seats left.`);
      return;
    }
    
    setIsLoading(true);
    toast.info("Processing your booking...");
    
    try {
      const formattedPassengers = passengerDetails.map(p => ({
        name: p.name,
        age: parseInt(p.age.toString()),
        gender: p.gender,
        contact: contactPhone
      }));
      
      const fareClass = 'AC First Class';
      
      const pnr = await createBooking({
        passengerData: formattedPassengers,
        trainId: train.id,
        fareClass: fareClass,
        paymentMethod: paymentMethod,
        totalAmount: calculateTotalAmount()
      });
      
      console.log("Booking successful with PNR:", pnr);
      toast.success("Train successfully booked! Your tickets have been reserved.");
      
      // Short delay before navigation to allow user to see the success message
      setTimeout(() => {
        navigate('/bookings');
      }, 1500);
    } catch (error: any) {
      console.error("Booking error:", error);
      toast.error(`There was an error processing your booking: ${error.message || 'Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateBaseFare = () => {
    return train.price;
  };
  
  const calculateTotalAmount = () => {
    return (calculateBaseFare() * passengers) + 50;
  };

  return (
    <Card className="w-full max-w-4xl shadow-lg border-t-4 border-t-railway-600">
      <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
        <CardTitle className="text-2xl text-railway-800">Passenger Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {Array.from({ length: passengers }).map((_, index) => (
            <div key={index} className="space-y-4 border-b pb-4 last:border-b-0">
              <h3 className="font-medium text-railway-700">Passenger {index + 1}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`name-${index}`}>Full Name</Label>
                  <Input
                    id={`name-${index}`}
                    value={passengerDetails[index]?.name || ''}
                    onChange={(e) => updatePassenger(index, 'name', e.target.value)}
                    className="border-gray-300 focus:border-railway-500 focus:ring-railway-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`age-${index}`}>Age</Label>
                  <Input
                    id={`age-${index}`}
                    type="number"
                    min="0"
                    max="120"
                    value={passengerDetails[index]?.age || ''}
                    onChange={(e) => updatePassenger(index, 'age', e.target.value)}
                    className="border-gray-300 focus:border-railway-500 focus:ring-railway-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <RadioGroup
                    value={passengerDetails[index]?.gender || 'male'} 
                    onValueChange={(value) => updatePassenger(index, 'gender', value)}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id={`male-${index}`} />
                      <Label htmlFor={`male-${index}`} className="cursor-pointer">Male</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id={`female-${index}`} />
                      <Label htmlFor={`female-${index}`} className="cursor-pointer">Female</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id={`other-${index}`} />
                      <Label htmlFor={`other-${index}`} className="cursor-pointer">Other</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          ))}

          <div className="space-y-4">
            <h3 className="font-medium text-railway-700">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="border-gray-300 focus:border-railway-500 focus:ring-railway-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="border-gray-300 focus:border-railway-500 focus:ring-railway-500"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-railway-700">Payment Method</h3>
            <RadioGroup
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-railway-50 cursor-pointer">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="cursor-pointer">Credit Card</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-railway-50 cursor-pointer">
                <RadioGroupItem value="upi" id="upi" />
                <Label htmlFor="upi" className="cursor-pointer">UPI</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-railway-50 cursor-pointer">
                <RadioGroupItem value="netbanking" id="netbanking" />
                <Label htmlFor="netbanking" className="cursor-pointer">Net Banking</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-4 bg-gradient-to-r from-railway-50 to-white p-4 rounded-lg">
            <h3 className="font-medium text-railway-700">Fare Summary</h3>
            <div className="flex justify-between">
              <span>Base Fare per passenger</span>
              <span>₹{calculateBaseFare()}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Base Fare ({passengers} passengers)</span>
              <span>₹{calculateBaseFare() * passengers}</span>
            </div>
            <div className="flex justify-between">
              <span>Service Fee</span>
              <span>₹50</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Total Amount</span>
              <span>₹{calculateTotalAmount()}</span>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-railway-600 hover:bg-railway-700 transform transition-transform duration-200 hover:scale-105 active:scale-95"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : `Confirm & Pay ₹${calculateTotalAmount()}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BookingForm;
