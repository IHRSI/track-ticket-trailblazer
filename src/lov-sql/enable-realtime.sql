
-- Enable realtime for the train table
ALTER TABLE train REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE train;

-- Enable realtime for the booking table
ALTER TABLE booking REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE booking;

-- Enable realtime for the payment table
ALTER TABLE payment REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE payment;

-- Enable realtime for the admin table
ALTER TABLE admin REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE admin;

-- Enable realtime for the cancellation table
ALTER TABLE cancellation REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE cancellation;
