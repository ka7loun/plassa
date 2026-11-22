// Demo data for Sousse (+ a small Monastir set to show multi-city).
// All people, businesses and bookings are fictional. Coordinates are
// approximate street positions chosen by hand from the OpenStreetMap map.

export const DEMO_USERS = {
  driver: { id: "00000000-0000-4000-8000-000000000001", name: "Yassine (démo)", phone: "+216 00 000 101" },
  host: { id: "00000000-0000-4000-8000-000000000002", name: "Salma Ben Ali (démo)", phone: "+216 00 000 102" },
  admin: { id: "00000000-0000-4000-8000-000000000003", name: "Opérateur ville (démo)", phone: null },
} as const;

export const CITIES = [
  { id: "sousse", fr: "Sousse", ar: "سوسة", en: "Sousse", lat: 35.8300, lng: 10.6300, zoom: 14 },
  { id: "monastir", fr: "Monastir", ar: "المنستير", en: "Monastir", lat: 35.7770, lng: 10.8250, zoom: 14 },
];

export const ZONES = [
  { id: "sousse-babbhar", city: "sousse", fr: "Bab Bhar / Centre", ar: "باب البحر / الوسط", en: "Bab Bhar / Centre", lat: 35.8280, lng: 10.6385 },
  { id: "sousse-medina", city: "sousse", fr: "Médina (abords)", ar: "المدينة العتيقة", en: "Medina (edges)", lat: 35.8250, lng: 10.6335 },
  { id: "sousse-boujaafar", city: "sousse", fr: "Boujaafar / Corniche", ar: "بوجعفر / الكورنيش", en: "Boujaafar / Corniche", lat: 35.8360, lng: 10.6300 },
  { id: "sousse-khezama", city: "sousse", fr: "Khezama", ar: "خزامة", en: "Khezama", lat: 35.8530, lng: 10.6080 },
  { id: "sousse-sahloul", city: "sousse", fr: "Sahloul", ar: "سهلول", en: "Sahloul", lat: 35.8370, lng: 10.5930 },
  { id: "sousse-kantaoui", city: "sousse", fr: "Port El Kantaoui", ar: "القنطاوي", en: "Port El Kantaoui", lat: 35.8905, lng: 10.5935 },
  { id: "monastir-centre", city: "monastir", fr: "Monastir Centre", ar: "وسط المنستير", en: "Monastir Centre", lat: 35.7770, lng: 10.8240 },
];

export const HOSTS = [
  DEMO_USERS.host,
  { id: "00000000-0000-4000-8000-000000000010", name: "Mohamed Trabelsi", phone: "+216 00 000 010" },
  { id: "00000000-0000-4000-8000-000000000011", name: "Amira Jaziri", phone: "+216 00 000 103" },
  { id: "00000000-0000-4000-8000-000000000012", name: "Hédi Gharbi", phone: "+216 00 000 104" },
  { id: "00000000-0000-4000-8000-000000000013", name: "Nour Mejri", phone: "+216 00 000 105" },
  { id: "00000000-0000-4000-8000-000000000014", name: "Karim Sfar", phone: "+216 00 000 106" },
  { id: "00000000-0000-4000-8000-000000000015", name: "Leila Haddad", phone: "+216 00 000 107" },
  { id: "00000000-0000-4000-8000-000000000016", name: "Sami Bouzid", phone: "+216 00 000 108" },
];

export const OTHER_DRIVERS = [
  { id: "00000000-0000-4000-8000-000000000020", name: "Ines K." },
  { id: "00000000-0000-4000-8000-000000000021", name: "Walid M." },
  { id: "00000000-0000-4000-8000-000000000022", name: "Rania S." },
  { id: "00000000-0000-4000-8000-000000000023", name: "Tarek B." },
  { id: "00000000-0000-4000-8000-000000000024", name: "Emma L." },
];

type SpotSeed = {
  host: number; // index in HOSTS
  zone: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  type: "garage" | "courtyard" | "driveway" | "lot" | "basement";
  covered?: boolean;
  price: number; // millimes per hour
  peak?: [number, number, number, number[]?]; // multiplier, startHour, endHour, months
  days?: number[];
  open?: [number, number]; // minutes
  gardien?: [string, string];
  desc: string;
};

const ALL = [0, 1, 2, 3, 4, 5, 6];
const MON_SAT = [1, 2, 3, 4, 5, 6];
const SUMMER = [6, 7, 8, 9];

export const SPOTS: SpotSeed[] = [
  // Bab Bhar / Centre — the hardest place to park
  { host: 0, zone: "sousse-babbhar", title: "Garage Dar Salma", address: "Rue de Paris, près de Bab Bhar", lat: 35.8291, lng: 10.6371, type: "garage", covered: true, price: 1500, peak: [1.3, 17, 21], days: MON_SAT, open: [480, 1260], desc: "Garage fermé, 1 voiture. 3 min à pied de Bab Bhar." },
  { host: 0, zone: "sousse-babbhar", title: "Cour Dar Salma (2e place)", address: "Rue de Paris", lat: 35.8293, lng: 10.6368, type: "courtyard", price: 1200, peak: [1.3, 17, 21], days: ALL, open: [420, 1380], desc: "Cour intérieure, portail. Idéal pour le souk." },
  { host: 1, zone: "sousse-babbhar", title: "Parking arrière Pharmacie Ennour", address: "Av. Habib Bourguiba", lat: 35.8301, lng: 10.6378, type: "lot", price: 2000, days: ALL, open: [1140, 1440], gardien: ["Am Hamadi", "+216 00 000 109"], desc: "4 places libres après la fermeture (19h)." },
  { host: 1, zone: "sousse-babbhar", title: "Bureau – sous-sol après 18h", address: "Av. Léopold Senghor", lat: 35.8312, lng: 10.6352, type: "basement", covered: true, price: 1800, days: MON_SAT, open: [1080, 1440], desc: "Sous-sol d'immeuble de bureaux, libre le soir." },
  { host: 2, zone: "sousse-babbhar", title: "Allée Villa Jasmin", address: "Rue Ali Belhouane", lat: 35.8268, lng: 10.6359, type: "driveway", price: 1500, days: ALL, open: [360, 1320], desc: "Allée privée, sortie facile." },
  { host: 3, zone: "sousse-babbhar", title: "Arrière-cour Café El Bahr", address: "Près de la place Farhat Hached", lat: 35.8277, lng: 10.6392, type: "courtyard", price: 2500, peak: [1.5, 18, 23, SUMMER], days: ALL, open: [600, 1440], gardien: ["Slim", "+216 00 000 110"], desc: "Cour derrière le café. Gardien sur place le soir." },
  { host: 4, zone: "sousse-babbhar", title: "Garage Rue de Constantine", address: "Rue de Constantine", lat: 35.8306, lng: 10.6334, type: "garage", covered: true, price: 1700, days: MON_SAT, open: [480, 1200], desc: "Garage simple, hauteur 2,1 m." },

  // Medina edges
  { host: 4, zone: "sousse-medina", title: "Cour près de Bab Jedid", address: "Bd. Yahia Ibn Omar", lat: 35.8236, lng: 10.6318, type: "courtyard", price: 1200, days: ALL, open: [420, 1260], desc: "Cour familiale, accès direct à la médina." },
  { host: 5, zone: "sousse-medina", title: "Atelier Sfar – place devant", address: "Rue de Tunis", lat: 35.8246, lng: 10.6301, type: "driveway", price: 1000, days: MON_SAT, open: [480, 1140], desc: "Place devant l'atelier, fermé le dimanche." },
  { host: 2, zone: "sousse-medina", title: "Parking privé Dar Jaziri", address: "Près du Ribat", lat: 35.8262, lng: 10.6322, type: "lot", price: 2000, peak: [1.3, 10, 18, SUMMER], days: ALL, open: [480, 1320], gardien: ["Am Béchir", "+216 00 000 111"], desc: "5 places, gardien la journée. 4 min du Ribat." },
  { host: 6, zone: "sousse-medina", title: "Garage Haddad", address: "Bd. Abdelhamid Kadhi", lat: 35.8225, lng: 10.6338, type: "garage", covered: true, price: 1300, days: ALL, open: [360, 1380], desc: "Garage couvert, idéal pour la journée." },

  // Boujaafar / Corniche
  { host: 3, zone: "sousse-boujaafar", title: "Parking Hôtel Corniche (privé)", address: "Av. Hédi Chaker", lat: 35.8365, lng: 10.6296, type: "lot", price: 2500, peak: [1.5, 9, 20, SUMMER], days: ALL, open: [420, 1440], gardien: ["Réception", "+216 00 000 112"], desc: "Places non utilisées par l'hôtel, plage à 2 min." },
  { host: 7, zone: "sousse-boujaafar", title: "Allée Villa Boujaafar", address: "Rue de la Corniche", lat: 35.8389, lng: 10.6271, type: "driveway", price: 1800, peak: [1.4, 10, 19, SUMMER], days: ALL, open: [480, 1260], desc: "Allée privée, plage Boujaafar à pied." },
  { host: 0, zone: "sousse-boujaafar", title: "Garage Résidence El Yasmine", address: "Av. Hédi Chaker", lat: 35.8346, lng: 10.6312, type: "basement", covered: true, price: 2000, days: ALL, open: [0, 1440], desc: "Sous-sol de résidence, accès 24h/24 avec code." },
  { host: 5, zone: "sousse-boujaafar", title: "Cour Dar Sfar", address: "Rue Abou Kacem Chebbi", lat: 35.8335, lng: 10.6332, type: "courtyard", price: 1500, days: ALL, open: [420, 1320], desc: "Cour avec portail, 2 places." },
  { host: 6, zone: "sousse-boujaafar", title: "Parking Clinique (soir)", address: "Av. du 14 Janvier", lat: 35.8402, lng: 10.6235, type: "lot", price: 1500, days: ALL, open: [1140, 1440], desc: "Parking du personnel, libre le soir." },

  // Khezama
  { host: 7, zone: "sousse-khezama", title: "Garage Khezama Est", address: "Rue Khezama Est", lat: 35.8535, lng: 10.6095, type: "garage", covered: true, price: 1000, days: ALL, open: [360, 1380], desc: "Garage simple, quartier calme." },
  { host: 1, zone: "sousse-khezama", title: "Parking Immeuble Les Pins", address: "Av. Yasser Arafat", lat: 35.8558, lng: 10.6052, type: "lot", price: 1200, days: MON_SAT, open: [480, 1200], desc: "Places visiteurs non utilisées en journée." },
  { host: 4, zone: "sousse-khezama", title: "Allée Villa Mejri", address: "Khezama Ouest", lat: 35.8512, lng: 10.6028, type: "driveway", price: 1000, days: ALL, open: [420, 1320], desc: "Allée privée, 1 voiture." },
  { host: 2, zone: "sousse-khezama", title: "Sous-sol Centre d'affaires", address: "Bd. 7 Novembre (Khezama)", lat: 35.8547, lng: 10.6116, type: "basement", covered: true, price: 1500, days: ALL, open: [1080, 1440], desc: "Sous-sol de bureaux, libre le soir et le week-end." },

  // Sahloul (hospital, university, clinics)
  { host: 6, zone: "sousse-sahloul", title: "Garage près de l'hôpital Sahloul", address: "Route de Ceinture", lat: 35.8362, lng: 10.5946, type: "garage", covered: true, price: 1200, days: ALL, open: [360, 1320], desc: "À 5 min à pied de l'hôpital. Pour visites et consultations." },
  { host: 3, zone: "sousse-sahloul", title: "Cour Résidence Sahloul 4", address: "Sahloul 4", lat: 35.8381, lng: 10.5908, type: "courtyard", price: 1000, days: ALL, open: [420, 1260], desc: "Cour de résidence, 3 places." },
  { host: 7, zone: "sousse-sahloul", title: "Parking Pharmacie de nuit", address: "Av. Ibn Khaldoun", lat: 35.8349, lng: 10.5972, type: "lot", price: 1500, days: ALL, open: [0, 1440], gardien: ["Am Fethi", "+216 00 000 113"], desc: "Places réservées Plassa, ouvert 24h/24." },
  { host: 5, zone: "sousse-sahloul", title: "Allée Villa Bouzid", address: "Sahloul 3", lat: 35.8397, lng: 10.5951, type: "driveway", price: 1000, days: MON_SAT, open: [480, 1140], desc: "Allée privée, en semaine." },

  // Port El Kantaoui — summer peak
  { host: 3, zone: "sousse-kantaoui", title: "Parking Restaurant La Marina (privé)", address: "Près de la marina", lat: 35.8918, lng: 10.5951, type: "lot", price: 3000, peak: [1.5, 18, 24, SUMMER], days: ALL, open: [600, 1440], gardien: ["Nabil", "+216 00 000 114"], desc: "8 places derrière le restaurant, marina à 1 min." },
  { host: 7, zone: "sousse-kantaoui", title: "Garage Villa Kantaoui", address: "Zone touristique", lat: 35.8887, lng: 10.5917, type: "garage", covered: true, price: 2500, peak: [1.4, 10, 22, SUMMER], days: ALL, open: [480, 1380], desc: "Garage de villa, location à l'heure en été." },
  { host: 6, zone: "sousse-kantaoui", title: "Allée Résidence Les Dunes", address: "Route touristique", lat: 35.8866, lng: 10.5962, type: "driveway", price: 2000, peak: [1.3, 10, 20, SUMMER], days: ALL, open: [480, 1320], desc: "Allée privée, accès plage." },
  { host: 0, zone: "sousse-kantaoui", title: "Cour Dar Kantaoui", address: "Hammam Sousse – Kantaoui", lat: 35.8902, lng: 10.5893, type: "courtyard", price: 2000, peak: [1.5, 18, 23, SUMMER], days: ALL, open: [600, 1440], desc: "Cour fermée, 2 places." },

  // Monastir (multi-city proof)
  { host: 2, zone: "monastir-centre", title: "Garage près du Ribat de Monastir", address: "Av. de l'Indépendance", lat: 35.7762, lng: 10.8236, type: "garage", covered: true, price: 1500, days: ALL, open: [420, 1320], desc: "Garage couvert, centre-ville." },
  { host: 4, zone: "monastir-centre", title: "Cour Dar Monastir", address: "Rue Bourguiba", lat: 35.7781, lng: 10.8215, type: "courtyard", price: 1200, days: ALL, open: [420, 1260], desc: "Cour avec portail, 2 places." },
  { host: 1, zone: "monastir-centre", title: "Parking Marina Monastir (privé)", address: "Près de la marina", lat: 35.7798, lng: 10.8292, type: "lot", price: 2000, peak: [1.3, 18, 23, SUMMER], days: ALL, open: [600, 1440], desc: "Places privées près de la marina." },
];

/** Relative demand weight per zone (searches per day) for the seeded city view. */
export const ZONE_DEMAND: Record<string, number> = {
  "sousse-babbhar": 34,
  "sousse-medina": 22,
  "sousse-boujaafar": 16,
  "sousse-khezama": 7,
  "sousse-sahloul": 14,
  "sousse-kantaoui": 9,
  "monastir-centre": 4,
};
