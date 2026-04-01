export default function handler(req, res) {
  res.status(200).json({ status: 'ok', service: 'switchboard', version: process.env.npm_package_version || 'unknown' });
}
