import OnboardingNewHireSelector from './OnboardingNewHireSelector'

export default function OnboardingHeader({
    employees,
    selectedEmployee,
    setSelectedEmployee
}) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Onboarding Checklists</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage new hire setups, IT assets, orientations and induction milestones</p>
            </div>
            
            {/* Employee Selector */}
            <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-gray-650 uppercase tracking-wider">Select New Hire</label>
                <OnboardingNewHireSelector
                    employees={employees}
                    selectedId={selectedEmployee}
                    onChange={setSelectedEmployee}
                />
            </div>
        </div>
    )
}
