select ssbsect_gradable_ind,sobptrm_fgrd_web_upd_ind from ssbsect, sobptrm  where ssbsect_term_code = :term and ssbsect_crn = :crn and sobptrm_term_code = :term and ssbsect_ptrm_code = sobptrm_ptrm_code

