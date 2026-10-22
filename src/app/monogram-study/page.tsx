import type {Metadata} from 'next';
import {MonogramStudy} from '@/components/public/monogram-study';
export const metadata:Metadata={title:'Monogram study',robots:{index:false,follow:false}};
export default function Page(){return <MonogramStudy/>;}
