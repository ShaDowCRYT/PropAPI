import { PrismaClient, PropertyType, ListingStatus, ViewingStatus } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

const AGENT_COUNT = 40;
const LISTINGS_PER_AGENT_MIN = 5;
const LISTINGS_PER_AGENT_MAX = 15;
const VIEWINGS_PER_LISTING_MAX = 4;

const PROPERTY_TYPES = Object.values(PropertyType);
const LISTING_STATUSES = Object.values(ListingStatus);
const VIEWING_STATUSES = Object.values(ViewingStatus);

const LAGOS_AREAS = [
  "Lekki", "Ikoyi", "Victoria Island", "Ikeja", "Yaba", "Surulere",
  "Ajah", "Magodo", "Gbagada", "Ikorodu", "Festac Town", "Ogudu",
];

function randomPrice(propertyType: PropertyType): bigint {
  const nairaRanges: Record<PropertyType, [number, number]> = {
    LAND: [3_000_000, 80_000_000],
    APARTMENT: [1_500_000, 40_000_000],
    HOUSE: [8_000_000, 250_000_000],
    COMMERCIAL: [5_000_000, 150_000_000],
  };
  const [min, max] = nairaRanges[propertyType];
  const naira = faker.number.int({ min, max });
  return BigInt(naira) * 100n;
}

async function wipe() {
  await prisma.review.deleteMany();
  await prisma.viewing.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.agent.deleteMany();
}

async function seed() {
  console.log("Wiping existing data...");
  await wipe();

  console.log(`Creating ${AGENT_COUNT} agents...`);
  const agents = await Promise.all(
    Array.from({ length: AGENT_COUNT }).map(() =>
      prisma.agent.create({
        data: {
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          phone: faker.phone.number(),
          agencyName: faker.company.name() + " Realty",
        },
      })
    )
  );

  console.log("Creating listings...");
  const listings = [];
  for (const agent of agents) {
    const count = faker.number.int({
      min: LISTINGS_PER_AGENT_MIN,
      max: LISTINGS_PER_AGENT_MAX,
    });
    for (let i = 0; i < count; i++) {
      const propertyType = faker.helpers.arrayElement(PROPERTY_TYPES);
      const listing = await prisma.listing.create({
        data: {
          agentId: agent.id,
          title: `${faker.helpers.arrayElement(["Luxury", "Cozy", "Spacious", "Modern", "Executive"])} ${propertyType.toLowerCase()} in ${faker.helpers.arrayElement(LAGOS_AREAS)}`,
          description: faker.lorem.paragraph(),
          propertyType,
          priceMinorUnits: randomPrice(propertyType),
          currency: "NGN",
          location: `${faker.helpers.arrayElement(LAGOS_AREAS)}, Lagos`,
          bedrooms: propertyType === "LAND" ? null : faker.number.int({ min: 1, max: 6 }),
          bathrooms: propertyType === "LAND" ? null : faker.number.int({ min: 1, max: 5 }),
          sizeSqm: faker.number.int({ min: 40, max: 2000 }),
          status: faker.helpers.arrayElement(LISTING_STATUSES),
        },
      });
      listings.push(listing);
    }
  }

  console.log("Creating viewings...");
  const viewings = [];
  for (const listing of listings) {
    const count = faker.number.int({ min: 0, max: VIEWINGS_PER_LISTING_MAX });
    for (let i = 0; i < count; i++) {
      const viewing = await prisma.viewing.create({
        data: {
          listingId: listing.id,
          requesterName: faker.person.fullName(),
          requesterEmail: faker.internet.email().toLowerCase(),
          requesterPhone: faker.phone.number(),
          scheduledAt: faker.date.soon({ days: 30 }),
          status: faker.helpers.arrayElement(VIEWING_STATUSES),
        },
      });
      viewings.push(viewing);
    }
  }

  console.log("Creating reviews for completed viewings...");
  const completedViewings = viewings.filter((v) => v.status === "COMPLETED");
  const listingById = new Map(listings.map((l) => [l.id, l]));
  let reviewCount = 0;
  for (const viewing of completedViewings) {
    if (faker.datatype.boolean({ probability: 0.6 })) {
      const listing = listingById.get(viewing.listingId)!;
      await prisma.review.create({
        data: {
          agentId: listing.agentId,
          viewingId: viewing.id,
          rating: faker.number.int({ min: 1, max: 5 }),
          comment: faker.lorem.sentence(),
        },
      });
      reviewCount++;
    }
  }

  console.log(
    `Done. Seeded ${agents.length} agents, ${listings.length} listings, ${viewings.length} viewings, ${reviewCount} reviews.`
  );
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });