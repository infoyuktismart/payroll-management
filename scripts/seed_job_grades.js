import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Custom env loader
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      envContent.split('\n').forEach((line) => {
        const parts = line.split('=')
        if (parts.length >= 2) {
          const key = parts[0].trim()
          const val = parts
            .slice(1)
            .join('=')
            .trim()
            .replace(/^['"]|['"]$/g, '')
          if (key) process.env[key] = val
        }
      })
    }
  } catch (e) {
    console.error('Error loading env:', e)
  }
}

loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing from env variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function seed() {
  try {
    console.log('Fetching companies...')
    const { data: companies, error: compErr } = await supabase.from('companies').select('id, name')

    if (compErr) throw compErr
    console.log(`Found ${companies?.length || 0} companies.`)

    for (const company of companies) {
      console.log(`Checking job grades for company: ${company.name} (${company.id})...`)
      const { data: existingGrades, error: gradeErr } = await supabase
        .from('job_grades')
        .select('id')
        .eq('company_id', company.id)

      if (gradeErr) throw gradeErr

      if (!existingGrades || existingGrades.length === 0) {
        console.log(`No job grades found for company: ${company.name}. Seeding defaults...`)

        const defaultGrades = [
          {
            company_id: company.id,
            grade_code: `L1_${company.id.substring(0, 4)}`,
            name: 'L1 - Junior Associate',
            min_salary: 10000,
            max_salary: 40000,
            description: 'Entry level role',
          },
          {
            company_id: company.id,
            grade_code: `L2_${company.id.substring(0, 4)}`,
            name: 'L2 - Associate',
            min_salary: 40000,
            max_salary: 80000,
            description: 'Intermediate role',
          },
          {
            company_id: company.id,
            grade_code: `L3_${company.id.substring(0, 4)}`,
            name: 'L3 - Senior Associate',
            min_salary: 80000,
            max_salary: 150000,
            description: 'Senior specialist role',
          },
          {
            company_id: company.id,
            grade_code: `L4_${company.id.substring(0, 4)}`,
            name: 'L4 - Lead',
            min_salary: 150000,
            max_salary: 300000,
            description: 'Leadership/Management role',
          },
          {
            company_id: company.id,
            grade_code: `L5_${company.id.substring(0, 4)}`,
            name: 'L5 - Principal',
            min_salary: 300000,
            max_salary: 800000,
            description: 'Director/Principal leadership role',
          },
        ]

        const { data: inserted, error: insertErr } = await supabase
          .from('job_grades')
          .insert(defaultGrades)
          .select()

        if (insertErr) {
          console.error(`Failed to insert for ${company.name}:`, insertErr)
        } else {
          console.log(
            `Successfully seeded ${inserted?.length || 0} job grades for ${company.name}.`
          )
        }
      } else {
        console.log(
          `Company ${company.name} already has ${existingGrades.length} job grades. Skipping.`
        )
      }
    }
    console.log('Seeding process completed successfully!')
  } catch (e) {
    console.error('Unexpected error during seeding:', e)
  }
}

seed()
