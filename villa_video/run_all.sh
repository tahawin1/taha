SP=/tmp/claude-0/-home-user-taha/8f08d91d-0b7a-5cce-9748-8f3d2797f0e3/scratchpad
cd /home/user/taha/villa_video
python3 bl.py -- photos 01_facade:900,1090,4.5,745,780,3.5,55 02_hall:757,790,1.7,757,700,3.6,68 03_salon:765,600,1.65,640,585,1.4,72 04_salon_marocain:610,705,1.6,570,775,0.9,72 05_salle_a_manger:835,500,1.65,885,445,1.1,64 06_terrasse_piscine:745,425,1.8,660,290,0.2,70 07_suite_parentale:610,742,5.4,690,785,4.8,70 08_cuisine:690,695,-1.15,600,770,-1.2,70 09_vue_aerienne:880,1050,22,750,640,2,58 > $SP/bl.log 2>&1
mkdir -p $SP/f2; for sh in 0 1; do node render.mjs $SP/f2 "0:0:10:$sh:2" 960 540 > $SP/l2_$sh.txt 2>&1 & done; wait
echo ALLDONE >> $SP/bl.log
