import { PrismaClient } from "@prisma/client"
import { US_STATES, CA_PROVINCES } from "../src/lib/location-data"

const prisma = new PrismaClient()

// Create a map of lowercase state/province names to their 2-letter codes
const stateMap = new Map<string, string>()

US_STATES.forEach(state => {
  stateMap.set(state.name.toLowerCase(), state.code)
  stateMap.set(state.code.toLowerCase(), state.code)
})

CA_PROVINCES.forEach(province => {
  stateMap.set(province.name.toLowerCase(), province.code)
  stateMap.set(province.code.toLowerCase(), province.code)
})

function getCode(name: string | null): string | null {
  if (!name) return null
  const cleanName = name.trim().toLowerCase()
  return stateMap.get(cleanName) || null
}

async function main() {
  console.log("Starting state code migration...")

  // 1. Organizations
  console.log("Checking Organizations...")
  const orgs = await prisma.organization.findMany({
    where: {
      stateProvince: { not: null }
    }
  })
  
  let orgCount = 0
  for (const org of orgs) {
    if (org.stateProvince && org.stateProvince.length > 2) {
      const code = getCode(org.stateProvince)
      if (code) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { stateProvince: code }
        })
        console.log(`Updated Organization ${org.name}: ${org.stateProvince} -> ${code}`)
        orgCount++
      } else {
        console.warn(`Warning: Could not map state "${org.stateProvince}" for Organization ${org.name}`)
      }
    }
  }
  console.log(`Updated ${orgCount} Organizations.`)

  // 2. UserBillingAddress
  console.log("Checking UserBillingAddresses...")
  const addresses = await prisma.userBillingAddress.findMany({
    where: {
      stateProvince: { not: null }
    }
  })
  
  let addrCount = 0
  for (const addr of addresses) {
    if (addr.stateProvince && addr.stateProvince.length > 2) {
      const code = getCode(addr.stateProvince)
      if (code) {
        await prisma.userBillingAddress.update({
          where: { id: addr.id },
          data: { stateProvince: code }
        })
        console.log(`Updated UserBillingAddress ${addr.id}: ${addr.stateProvince} -> ${code}`)
        addrCount++
      } else {
        console.warn(`Warning: Could not map state "${addr.stateProvince}" for UserBillingAddress ${addr.id}`)
      }
    }
  }
  console.log(`Updated ${addrCount} UserBillingAddresses.`)

  // 3. Facility
  console.log("Checking Facilities...")
  const facilities = await prisma.facility.findMany({
    where: {
      stateProvince: { not: null }
    }
  })
  
  let facCount = 0
  for (const fac of facilities) {
    if (fac.stateProvince && fac.stateProvince.length > 2) {
      const code = getCode(fac.stateProvince)
      if (code) {
        await prisma.facility.update({
          where: { id: fac.id },
          data: { stateProvince: code }
        })
        console.log(`Updated Facility ${fac.name}: ${fac.stateProvince} -> ${code}`)
        facCount++
      } else {
        console.warn(`Warning: Could not map state "${fac.stateProvince}" for Facility ${fac.name}`)
      }
    }
  }
  console.log(`Updated ${facCount} Facilities.`)

  // 4. Competition
  console.log("Checking Competitions...")
  const comps = await prisma.competition.findMany({
    where: {
      stateProvince: { not: null }
    }
  })
  
  let compCount = 0
  for (const comp of comps) {
    if (comp.stateProvince && comp.stateProvince.length > 2) {
      const code = getCode(comp.stateProvince)
      if (code) {
        await prisma.competition.update({
          where: { id: comp.id },
          data: { stateProvince: code }
        })
        console.log(`Updated Competition ${comp.name}: ${comp.stateProvince} -> ${code}`)
        compCount++
      } else {
        console.warn(`Warning: Could not map state "${comp.stateProvince}" for Competition ${comp.name}`)
      }
    }
  }
  console.log(`Updated ${compCount} Competitions.`)

  console.log("Migration complete!")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
