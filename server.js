require('dotenv').config();
const express = require('express'), cors = require('cors');
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET missing in .env'); process.exit(1); }
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN })); app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/student', require('./routes/student'));
app.use('/api/recruiter', require('./routes/recruiter'));
app.use('/api', require('./routes/common'));
app.use('/api', require('./routes/extra'));
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: 'Server error' }); });
app.listen(process.env.PORT || 5000, () => console.log('API running'));
