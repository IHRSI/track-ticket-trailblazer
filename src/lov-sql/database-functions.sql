
-- Function to safely decrement a value in a column
CREATE OR REPLACE FUNCTION public.decrement(row_id uuid, value integer)
RETURNS integer AS $$
DECLARE
  current_value integer;
BEGIN
  -- Get the current value
  SELECT available_seats INTO current_value FROM train WHERE train_id = row_id;
  
  -- Only decrement if result would be non-negative
  IF current_value >= value THEN
    UPDATE train SET available_seats = available_seats - value WHERE train_id = row_id;
    RETURN current_value - value;
  ELSE
    -- If not enough seats, set to 0
    UPDATE train SET available_seats = 0 WHERE train_id = row_id;
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to safely increment a value in a column
CREATE OR REPLACE FUNCTION public.increment(row_id uuid, value integer)
RETURNS integer AS $$
DECLARE
  current_value integer;
  max_value integer;
BEGIN
  -- Get the current value and max value (total seats)
  SELECT available_seats, total_seats INTO current_value, max_value FROM train WHERE train_id = row_id;
  
  -- Only increment if it wouldn't exceed the maximum
  IF current_value + value <= max_value THEN
    UPDATE train SET available_seats = available_seats + value WHERE train_id = row_id;
    RETURN current_value + value;
  ELSE
    -- If it would exceed, set to max
    UPDATE train SET available_seats = max_value WHERE train_id = row_id;
    RETURN max_value;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update revenue on payment
CREATE OR REPLACE FUNCTION public.update_revenue_on_payment()
RETURNS trigger AS $$
BEGIN
  -- For new payment records or status changes
  IF (TG_OP = 'INSERT' AND NEW.status = 'Successful') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'Successful' AND OLD.status != 'Successful') THEN
    -- Insert or update admin record with incremented revenue
    IF EXISTS (SELECT 1 FROM admin) THEN
      UPDATE admin SET total_revenue = total_revenue + NEW.amount;
    ELSE
      INSERT INTO admin (username, password, total_revenue)
      VALUES ('admin', 'admin123', NEW.amount);
    END IF;
  -- For cancelled payments
  ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'Successful' AND NEW.status != 'Successful') THEN
    UPDATE admin SET total_revenue = total_revenue - OLD.amount WHERE total_revenue >= OLD.amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update revenue on refund
CREATE OR REPLACE FUNCTION public.update_revenue_on_refund()
RETURNS trigger AS $$
BEGIN
  -- For new refund records
  IF (TG_OP = 'INSERT' AND NEW.status = 'Processed') THEN
    -- Decrease total revenue by refund amount
    UPDATE admin SET total_revenue = total_revenue - NEW.refund_amount 
    WHERE total_revenue >= NEW.refund_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update train seats when booking status changes
CREATE OR REPLACE FUNCTION public.update_train_seats()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Decrease available seats when a new booking is made
    IF NEW.booking_status = 'Confirmed' THEN
      UPDATE train SET available_seats = available_seats - 1 
      WHERE train_id = NEW.train_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If booking status changed from something else to 'Confirmed'
    IF OLD.booking_status != 'Confirmed' AND NEW.booking_status = 'Confirmed' THEN
      UPDATE train SET available_seats = available_seats - 1 
      WHERE train_id = NEW.train_id;
    -- If booking status changed from 'Confirmed' to 'Cancelled'
    ELSIF OLD.booking_status = 'Confirmed' AND NEW.booking_status = 'Cancelled' THEN
      UPDATE train SET available_seats = available_seats + 1 
      WHERE train_id = NEW.train_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
