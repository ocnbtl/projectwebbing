import styles from './isitusa-identity.module.css';

/** Use the brand kit's outlined artwork so approved kerning survives every size. */
export function IsitusaIdentity({full=false,light=true}:{full?:boolean;light?:boolean}){
 return <span className={styles.identity} data-full={full} data-light={light}>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={`/media/projects/isitusa-brand-20261016/${full?'full-name':'wordmark'}.svg`} alt={full?'Invasive Species In The United States of America':'ISITUSA'} width={full?11150:3696} height={full?1874:760}/>
 </span>;
}
