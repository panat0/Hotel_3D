// ข้อมูลโรงแรมทั้งหมดอยู่ที่นี่ — แก้ไฟล์นี้ได้โดยไม่ต้องแตะโค้ด
// หมายเหตุ: ตึก ชั้น และห้องเป็นโมเดล 3D สร้างด้วยโค้ด (Three.js)
// ภาพถ่าย/render จริงของห้อง ใส่ได้ที่ roomTypes.<ประเภท>.imgs (ใช้ในแผงรายละเอียดห้อง)
window.HOTEL = {
  name: "Aurelia Tower",
  tagline: "โรงแรม 5 ดาว 18 ชั้น",
  contact: "โทร 02-000-0000",
  // จุดกดบนฉาก Arrival และ Rooftop — pos = [x, y, z] ในพื้นที่ 3D (หน่วยเมตร)
  street: [
    { n:1, pos:[0, 1.5, 6.6],    title:"ทางเข้าหลัก & ล็อบบี้", desc:"ประตูต้อนรับใต้หลังคาทอง พร้อมบริการจอดรถและเบลล์แมน" },
    { n:2, pos:[-7.2, 2.4, 4.6], title:"ร้านอาหาร Terrace",    desc:"โซนทานอาหารชั้น 2 เปิดรับลูกค้าภายนอก ติดทางเข้า" },
    { n:3, pos:[7.2, 1.2, 4.6],  title:"คาเฟ่ & เบเกอรี่",     desc:"กาแฟและขนมอบสดใหม่ทุกเช้า" }
  ],
  rooftop: [
    { n:1, pos:[-1.6, 19.5, 0.6], title:"Sky Pool",    desc:"สระว่ายน้ำอินฟินิตี้ ชั้น 18 วิวเมือง 360 องศา" },
    { n:2, pos:[3.6, 19.8, -1.2], title:"Rooftop Bar", desc:"บาร์ค็อกเทลเปิดถึงตีหนึ่ง" }
  ],
  roomTypes: {
    deluxe: { name:"Deluxe",          size:32,  bed:"King / Twin",      price:3800,  guests:2, imgs:[] },
    club:   { name:"Club Room",       size:38,  bed:"King",             price:5200,  guests:2, imgs:[] },
    suite:  { name:"Executive Suite", size:68,  bed:"King + Living",    price:9800,  guests:3, imgs:[] },
    sky:    { name:"Sky Suite",       size:110, bed:"2 King + Lounge",  price:18500, guests:4, imgs:[] }
  },
  // ชั้น (เรียงจากล่างขึ้นบน) kind: rooms | lobby | dining | fitness | pool | rooftop
  // zones: x,y = ตำแหน่งกึ่งกลาง w,h = ขนาด เป็น % ของพื้นที่ชั้น
  floors: [
    { f:1,  kind:"lobby",   title:"ล็อบบี้ & ต้อนรับ", desc:"ล็อบบี้สูงโปร่ง เคาน์เตอร์เช็คอิน เลานจ์รอ และเบลล์เดสก์",
      zones:[ {t:"ทางเข้าหลัก",x:50,y:90,w:20,h:14}, {t:"เช็คอิน",x:25,y:45,w:30,h:26}, {t:"เลานจ์",x:72,y:45,w:36,h:36}, {t:"ลิฟต์",x:50,y:14,w:20,h:16} ] },
    { f:2,  kind:"dining",  title:"ร้านอาหาร All-Day Dining", desc:"ร้านอาหารนานาชาติ บุฟเฟ่ต์เช้า และห้องจัดเลี้ยงเล็ก",
      zones:[ {t:"โซนบุฟเฟ่ต์",x:28,y:50,w:40,h:60}, {t:"ที่นั่งริมหน้าต่าง",x:74,y:30,w:38,h:30}, {t:"ห้องครัวเปิด",x:74,y:74,w:38,h:30} ] },
    { f:3,  kind:"fitness", title:"ฟิตเนส & สปา", desc:"ฟิตเนสเปิด 24 ชม. โซนเวทเทรนนิ่ง โยคะ และห้องสปา",
      zones:[ {t:"Cardio",x:25,y:32,w:34,h:36}, {t:"Free Weights",x:68,y:32,w:34,h:36}, {t:"สตูดิโอโยคะ",x:25,y:74,w:34,h:30}, {t:"สปา",x:68,y:74,w:34,h:30} ] },
    { f:4, kind:"rooms", type:"deluxe" }, { f:5, kind:"rooms", type:"deluxe" },
    { f:6, kind:"rooms", type:"deluxe" }, { f:7, kind:"rooms", type:"deluxe" },
    { f:8, kind:"rooms", type:"club" },
    { f:9,  kind:"pool",    title:"Mid-level Pool Deck", desc:"สระว่ายน้ำกลางตึก ชั้น 9 พร้อมเตียงอาบแดดและพูลบาร์เล็ก",
      zones:[ {t:"สระว่ายน้ำ",x:44,y:42,w:76,h:40}, {t:"Sun Deck",x:50,y:82,w:80,h:20}, {t:"พูลบาร์",x:88,y:42,w:16,h:40} ] },
    { f:10, kind:"rooms", type:"club" }, { f:11, kind:"rooms", type:"club" },
    { f:12, kind:"rooms", type:"club" }, { f:13, kind:"rooms", type:"club" },
    { f:14, kind:"fitness", title:"Club Fitness & Lounge", desc:"ฟิตเนสเฉพาะแขก Club/Suite พร้อมเลานจ์และเครื่องดื่ม",
      zones:[ {t:"ฟิตเนส Club",x:30,y:50,w:46,h:60}, {t:"เลานจ์",x:76,y:50,w:36,h:60} ] },
    { f:15, kind:"rooms", type:"suite" }, { f:16, kind:"rooms", type:"suite" },
    { f:17, kind:"rooms", type:"sky" },
    { f:18, kind:"rooftop", title:"Rooftop Pool & Bar", desc:"สระว่ายน้ำอินฟินิตี้และบาร์ดาดฟ้าวิว 360 องศา",
      zones:[ {t:"Infinity Pool",x:34,y:46,w:56,h:40}, {t:"Rooftop Bar",x:80,y:40,w:32,h:34}, {t:"Lounge Deck",x:50,y:84,w:84,h:16} ] }
  ]
};
