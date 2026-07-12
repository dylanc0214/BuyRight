import { Link } from 'react-router-dom';
export default function Header() {
  return (
    <header style={{background:'#fff',borderBottom:'1px solid #efece5',padding:'0 24px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <Link to="/" style={{fontWeight:700,fontSize:18,color:'#ff5a2b'}}>BuyRight</Link>
      <nav style={{display:'flex',gap:16}}>
        <Link to="/cars" style={{color:'#1a1a1a',fontSize:14}}>Browse</Link>
        <Link to="/chat" style={{color:'#1a1a1a',fontSize:14}}>AI Chat</Link>
        <Link to="/sell" style={{color:'#1a1a1a',fontSize:14}}>Sell</Link>
        <Link to="/login" style={{color:'#ff5a2b',fontSize:14,fontWeight:600}}>Login</Link>
      </nav>
    </header>
  );
}
