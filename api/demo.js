// api/demo.js
const { Pool } = require('pg');
const { Resend } = require('resend');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Resend: para emails (opcional si no hay API key)
const resendApiKey = process.env.RESEND_API_KEY;
const resend =
  resendApiKey && new Resend(resendApiKey);

module.exports = async (req, res) => {
  // Solo permitimos POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Vercel parsea JSON si viene con Content-Type: application/json
  const { full_name, email, role, kommun, message } = req.body || {};
  const organization = [role, kommun].filter(Boolean).join(' – ');

    if (!full_name || !email) {
      return res.status(400).json({ error: 'Namn och e-post krävs.' });
    }

    // Aseguramos que la tabla exista (por seguridad)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo_requests (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(200),
        email VARCHAR(200) NOT NULL,
        organization VARCHAR(200),
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Guardar en la base
    await pool.query(
      `
      INSERT INTO demo_requests (full_name, email, organization, message)
      VALUES ($1, $2, $3, $4)
    `,
      [full_name, email, organization || null, message || null]
    );

    // Enviar email a ti (solo si hay API key configurada)
      // Enviar email a ti (solo si hay API key configurada)
    let emailResult = null;

    if (resend) {
      try {
        emailResult = await resend.emails.send({
          // usa dominio verificado
          from: 'LSS Flow <care@neuroljus.com>',
          to: ['ospieli85@gmail.com'],
          reply_to: email,

          subject: 'Ny demo-förfrågan från LSS Flow',
          text: `
Ny demo-förfrågan:

Namn: ${full_name}
E-post: ${email}
Kommun/organisation: ${organization || '-'}

Meddelande:
${message || '(inget meddelande)'}

Mottagen: ${new Date().toISOString()}
          `.trim()
        });
        console.log('Resend response:', emailResult);
      } catch (emailError) {
        console.error(
          'Error sending notification email:',
          emailError?.message,
          emailError?.response?.data
        );
      }
    }

        return res.status(200).json({
      success: true,
      emailSent: !!emailResult
    });
  } catch (error) {
    console.error('Error saving demo request:', error);
    return res.status(500).json({ error: 'Internt serverfel.' });
  }
};
