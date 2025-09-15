import React from 'react';

const Message = ({ sender, text }) => {
  return (
    <div style={{ textAlign: sender === 'user' ? 'right' : 'left' }}>
      <p><strong>{sender}:</strong> {text}</p>
    </div>
  );
};

export default Message;