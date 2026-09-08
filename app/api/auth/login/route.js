import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "../../../../lib/supabase";
import { signToken } from "../../../../lib/auth";

function hash(s){return crypto.createHash("sha256").update(s).digest("hex")}

export async function POST(req){
  try{
    const {username,password}=await req.json();
    if(!username||!password) return NextResponse.json({error:"Username and password required"},{status:400});

    if(username===process.env.ADMIN_USERNAME && password===process.env.ADMIN_PASSWORD){
      const token=await signToken({sub:"admin",role:"admin",username});
      return NextResponse.json({token,role:"admin"});
    }

    const {data,error}=await supabase.from("users").select("id,username,password_hash,role").eq("username",username).maybeSingle();
    if(error) throw error;
    if(!data||data.password_hash!==hash(password)||data.role!=="reseller") return NextResponse.json({error:"Invalid credentials"},{status:401});

    const token=await signToken({sub:data.id,role:"reseller",username:data.username});
    return NextResponse.json({token,role:"reseller"});
  }catch(e){return NextResponse.json({error:"Server error"},{status:500})}
}
