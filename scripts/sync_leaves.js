// sync_leaves.js

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function syncApprovedLeaves() {
  console.log('Fetching approved leaves...')
  const { data: leaves, error: leafErr } = await supabase
    .from('leaves')
    .select('*')
    .eq('status', 'approved')

  if (leafErr) {
    console.error('Error fetching leaves:', leafErr)
    return
  }

  console.log(`Found ${leaves.length} approved leaves. Syncing...`)

  for (const leave of leaves) {
    const start = new Date(leave.start_date)
    const end = new Date(leave.end_date)
    const attendanceUpdates = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      attendanceUpdates.push({
        employee_id: leave.employee_id,
        date: dateStr,
        status: 'on_leave',
        remarks: `Approved Leave: ${leave.leave_type}`,
      })
    }

    if (attendanceUpdates.length > 0) {
      const { error: attErr } = await supabase
        .from('attendance')
        .upsert(attendanceUpdates, { onConflict: 'employee_id, date' })
      if (attErr) console.error(`Error syncing leave ${leave.id}:`, attErr)
      else console.log(`Synced leave ${leave.id} for employee ${leave.employee_id}`)
    }
  }

  // Also sync rejected leaves (mark as absent with remark)
  console.log('Fetching rejected leaves...')
  const { data: rejected, error: rejErr } = await supabase
    .from('leaves')
    .select('*')
    .eq('status', 'rejected')

  if (rejErr) {
    console.error('Error fetching rejected leaves:', rejErr)
    return
  }

  for (const leave of rejected) {
    const start = new Date(leave.start_date)
    const end = new Date(leave.end_date)

    // For simplicity, we'll just mark as absent where on_leave exists or missing
    // In the actual app we handle this more carefully, but for migration:
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const { error: attErr } = await supabase.from('attendance').upsert(
        [
          {
            employee_id: leave.employee_id,
            date: dateStr,
            status: 'absent',
            remarks: 'Leave Request Rejected',
          },
        ],
        { onConflict: 'employee_id, date' }
      )
      if (attErr) console.error(`Error syncing rejected leave ${leave.id}:`, attErr)
    }
  }

  console.log('Sync complete!')
}

syncApprovedLeaves()
