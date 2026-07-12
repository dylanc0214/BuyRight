import { Outlet } from 'react-router-dom';
export default function AdminLayout() {
  return (
    <div style={{display:'flex'}}>
      <nav style={{width:200,background:'#fbfaf8',padding:'20px',borderRight:'1px solid #efece5'}}>
        <p>Admin Nav</p>
      </nav>
      <div style={{flex:1,padding:24}}>
        <Outlet />
      </div>
    </div>
  );
}
