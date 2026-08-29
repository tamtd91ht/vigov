/** Kiểm tra quyền của tài khoản RabbitMQ: khai báo hàng đợi, gửi, nhận. */
const amqp = require("amqplib");

const URI = "amqp://rbmapp:fci98s6fzVsJG4N@192.168.3.135:5672/";
const QUEUE = "vigov.permcheck";

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: quá ${ms}ms không phản hồi`)), ms)),
  ]);
}

(async () => {
  const conn = await withTimeout(amqp.connect(URI), 8000, "connect");
  console.log("✓ Kết nối + xác thực OK");
  conn.on("error", (e) => console.log("  [lỗi kết nối]", e.message));

  const ch = await withTimeout(conn.createChannel(), 5000, "createChannel");
  console.log("✓ Mở kênh OK");
  // Kênh bị máy chủ đóng khi thiếu quyền — bắt sự kiện để biết lý do thật
  ch.on("error", (e) => console.log("  [lỗi kênh]", e.message));
  ch.on("close", () => console.log("  [kênh đã đóng]"));

  try {
    await withTimeout(ch.assertQueue(QUEUE, { durable: false, autoDelete: true }), 6000, "assertQueue");
    console.log("✓ Khai báo hàng đợi OK (có quyền configure)");
  } catch (err) {
    console.log("✗ Khai báo hàng đợi THẤT BẠI:", err.message);
    console.log("  → Tài khoản nhiều khả năng thiếu quyền 'configure' trên vhost này");
    process.exit(1);
  }

  try {
    ch.sendToQueue(QUEUE, Buffer.from("ping"));
    await new Promise((r) => setTimeout(r, 500));
    const msg = await withTimeout(ch.get(QUEUE, { noAck: true }), 5000, "get");
    console.log("✓ Gửi/nhận OK:", msg ? msg.content.toString() : "(không có tin)");
    await ch.deleteQueue(QUEUE);
  } catch (err) {
    console.log("✗ Gửi/nhận thất bại:", err.message);
  }

  await ch.close().catch(() => {});
  await conn.close().catch(() => {});
  process.exit(0);
})().catch((err) => {
  console.log("✗ Lỗi:", err.message);
  process.exit(1);
});
