import { Outlet } from "react-router"

/** Main website Layout */
function layout() {
  return (
    <div>
      <Outlet />
    </div>
  )
}

export default layout
