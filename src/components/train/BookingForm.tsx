
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Train } from '@/types/railBooker';
import { createBooking } from '@/services/trainService';

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
  const [fareClass, setFareClass] = useState('AC First Class');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const updatePassenger = (index: number, field: string, value: string) => {
    const updatedPassengers = [...passengerDetails];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };
    setPassengerDetails(updatedPassengers);
  };

  const validateForm = () => {
    // Check if all passenger details are filled
    const validPassengers = passengerDetails.every(p => 
      p.name && p.age && parseInt(p.age.toString()) > 0 && p.gender
    );
    
    if (!validPassengers) {
      toast.error("Please fill in all passenger details");
      return false;
    }
    
    // Check contact information
    if (!contactEmail || !contactPhone) {
      toast.error("Please provide contact information");
      return false;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    
    // Validate phone format (simple check for now)
    if (contactPhone.length < 10) {
      toast.error("Please enter a valid phone number");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Format passenger data
      const formattedPassengers = passengerDetails.map(p => ({
        name: p.name,
        age: parseInt(p.age.toString()),
        gender: p.gender,
        contact: contactPhone
      }));
      
      // Create the booking
      const pnr = await createBooking({
        passengerData: formattedPassengers,
        trainId: train.id,
        fareClass: fareClass,
        paymentMethod: paymentMethod,
        totalAmount: calculateTotalAmount()
      });
      
      toast.success("Booking successful! Your tickets have been reserved.");
      navigate('/bookings');
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("There was an error processing your booking. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate fare based on selected class
  const getFareMultiplier = () => {
    switch (fareClass) {
      case 'AC First Class': return 1.0;
      case 'AC 2 Tier': return 0.8;
      case 'AC 3 Tier': return 0.6;
      case 'Sleeper': return 0.4;
      default: return 1.0;
    }
  };
  
  const calculateFare = () => {
    // Check if the train has fares data
    if (train.fares && train.fares.length > 0) {
      // Try to find the fare for the selected class
      const selectedFare = train.fares.find(fare => fare.class === fareClass);
      if (selectedFare) {
        return selectedFare.amount;
      }
    }
    
    // Fallback to calculate based on base price and multiplier
    return Math.round(train.price * getFareMultiplier());
  };
  
  const calculateTotalAmount = () => {
    return (calculateFare() * Number(passengers)) + 50; // Base fare + service fee
  };

  return (
    <Card className="w-full max-w-4xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Passenger Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Class Selection */}
          <div className="space-y-4">
            <h3 className="font-medium">Select Travel Class</h3>
            <Select 
              value={fareClass} 
              onValueChange={setFareClass}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AC First Class">AC First Class</SelectItem>
                <SelectItem value="AC 2 Tier">AC 2 Tier</SelectItem>
                <SelectItem value="AC 3 Tier">AC 3 Tier</SelectItem>
                <SelectItem value="Sleeper">Sleeper</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Passenger details */}
          {Array.from({ length: Number(passengers) }).map((_, index) => (
            <div key={index} className="space-y-4 border-b pb-4 last:border-b-0">
              <h3 className="font-medium">Passenger {index + 1}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`name-${index}`}>Full Name</Label>
                  <Input
                    id={`name-${index}`}
                    value={passengerDetails[index]?.name || ''}
                    onChange={(e) => updatePassenger(index, 'name', e.target.value)}
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
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select 
                    value={passengerDetails[index]?.gender || 'male'} 
                    onValueChange={(value) => updatePassenger(index, 'gender', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="font-medium">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
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
                  required
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-4">
            <h3 className="font-medium">Payment Method</h3>
            <RadioGroup
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="flex items-center space-x-2 border rounded-md p-4">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="cursor-pointer">Credit Card</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-4">
                <RadioGroupItem value="upi" id="upi" />
                <Label htmlFor="upi" className="cursor-pointer">UPI</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-4">
                <RadioGroupItem value="netbanking" id="netbanking" />
                <Label htmlFor="netbanking" className="cursor-pointer">Net Banking</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Fare Summary */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium">Fare Summary</h3>
            <div className="flex justify-between">
              <span>Class</span>
              <span>{fareClass}</span>
            </div>
            <div className="flex justify-between">
              <span>Base Fare per passenger</span>
              <span>₹{calculateFare()}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Base Fare ({passengers} passengers)</span>
              <span>₹{calculateFare() * Number(passengers)}</span>
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
            className="w-full bg-railway-600 hover:bg-railway-700"
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
