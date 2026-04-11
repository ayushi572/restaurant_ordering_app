const QRCode = require('qrcode');
const Table = require('../models/Table');
const mongoose = require('mongoose');
require('dotenv').config();

// Generate QR codes for all tables
async function generateQRCodes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const tables = await Table.find({});
    console.log(`Generating QR codes for ${tables.length} tables...`);

    for (const table of tables) {
      // QR code contains restaurantId and tableId
      const qrData = JSON.stringify({
        restaurantId: table.restaurantId,
        tableId: table._id.toString()
      });

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      table.qrCode = qrCodeDataURL;
      await table.save();
      console.log(`Generated QR for Table ${table.number}`);
    }

    console.log('All QR codes generated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error generating QR codes:', error);
    process.exit(1);
  }
}

// Generate single QR code
async function generateSingleQR(restaurantId, tableId) {
  const qrData = JSON.stringify({ restaurantId, tableId });
  const qrCodeDataURL = await QRCode.toDataURL(qrData);
  return qrCodeDataURL;
}

module.exports = { generateQRCodes, generateSingleQR };

// Run if called directly
if (require.main === module) {
  generateQRCodes();
}