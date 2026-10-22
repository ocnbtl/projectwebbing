import type {Metadata} from "next";
import {FontGallery} from "@/components/public/font-gallery";
export const metadata:Metadata={title:"Wordmark study",robots:{index:false,follow:false}};
export default function Page(){return <FontGallery/>;}
