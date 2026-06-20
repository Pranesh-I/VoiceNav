import React from 'react';

export const CustomUI = () => {
  return (
    <div>
      <div role="button" tabIndex={0}>Clickable Div</div>
      
      <PaymentForm />
    </div>
  );
};

const PaymentForm = () => {
  return (
    <form>
      <legend>Payment Details</legend>
      <CreditCardInput placeholder="Card number" />
      <CountrySelect />
    </form>
  );
};

const CreditCardInput = (props: any) => <input {...props} />;
const CountrySelect = () => <select><option>US</option></select>;
