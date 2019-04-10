select spriden_id, sfrstcr_grde_code, sfrstcr_gmod_code, sfrstcr_levl_code, sfrstcr_pidm, sfrstcr_crn, sfrstcr_grde_date from sfrstcr, spriden 
where sfrstcr_term_code = :term and sfrstcr_crn = :crn  and spriden_change_ind is null and spriden_pidm = sfrstcr_pidm
