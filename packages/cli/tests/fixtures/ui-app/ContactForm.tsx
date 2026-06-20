import React from 'react';

export class ContactForm extends React.Component {
  render() {
    return (
      <form id="contact">
        <h1>Contact Us</h1>
        
        {/* Label linked via htmlFor */}
        <label htmlFor="emailInput">Email Address</label>
        <input type="email" id="emailInput" name="email" placeholder="you@example.com" />
        
        {/* Nested label */}
        <label>
          Subject
          <select name="subject">
            <option>Help</option>
            <option>Sales</option>
          </select>
        </label>
        
        {/* Unlabelled input */}
        <textarea name="message" placeholder="Type your message here..." />
        
        {/* Checkbox */}
        <label>
          <input type="checkbox" name="subscribe" />
          Subscribe to newsletter
        </label>

        {/* Radio */}
        <label>
          <input type="radio" name="contact_method" value="email" />
          Email me
        </label>
        
        <button type="submit">Send Message</button>
      </form>
    );
  }
}
